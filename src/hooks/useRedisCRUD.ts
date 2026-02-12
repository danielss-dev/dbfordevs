import { useCallback } from "react";
import { useRedisChangesStore } from "@/stores/redis-changes";
import { useRedis, useToast } from "@/hooks";

export function useRedisCRUD() {
  const { pendingChanges, clearChanges, removeChange } = useRedisChangesStore();
  const {
    setString,
    hashSet,
    hashDelete,
    setAdd,
    setRemove,
    zsetAdd,
    zsetRemove,
    listPush,
    listSet,
    listRemove,
  } = useRedis();
  const { toast } = useToast();

  const commitRedisChanges = useCallback(async () => {
    if (pendingChanges.length === 0) return 0;

    let successCount = 0;
    const failedIds = new Set<string>();

    for (const change of pendingChanges) {
      try {
        const { connectionId, key, operation } = change;

        switch (operation.op) {
          case "SET":
            await setString(connectionId, key, operation.value);
            break;
          case "HSET":
            await hashSet(connectionId, key, [
              { field: operation.field, value: operation.value },
            ]);
            break;
          case "HDEL":
            await hashDelete(connectionId, key, [operation.field]);
            break;
          case "SADD":
            await setAdd(connectionId, key, [operation.member]);
            break;
          case "SREM":
            await setRemove(connectionId, key, [operation.member]);
            break;
          case "ZADD":
            await zsetAdd(connectionId, key, [
              { member: operation.member, score: operation.score },
            ]);
            break;
          case "ZREM":
            await zsetRemove(connectionId, key, [operation.member]);
            break;
          case "LSET":
            await listSet(connectionId, key, operation.index, operation.value);
            break;
          case "RPUSH":
            await listPush(connectionId, key, [operation.value], false);
            break;
          case "LPUSH":
            await listPush(connectionId, key, [operation.value], true);
            break;
          case "LREM":
            await listRemove(connectionId, key, 1, operation.value);
            break;
        }

        successCount++;
        removeChange(change.id);
      } catch (error) {
        failedIds.add(change.id);
        console.error(`Failed to commit Redis change ${change.id}:`, error);
      }
    }

    if (failedIds.size > 0) {
      toast({
        title: "Some changes failed",
        description: `${successCount} committed, ${failedIds.size} failed.`,
        variant: "destructive",
      });
    } else if (successCount > 0) {
      toast({
        title: "Changes committed",
        description: `${successCount} Redis ${successCount === 1 ? "change" : "changes"} applied successfully.`,
      });
    }

    return successCount;
  }, [
    pendingChanges,
    removeChange,
    setString,
    hashSet,
    hashDelete,
    setAdd,
    setRemove,
    zsetAdd,
    zsetRemove,
    listPush,
    listSet,
    listRemove,
    toast,
  ]);

  const discardRedisChanges = useCallback(() => {
    clearChanges();
  }, [clearChanges]);

  return {
    commitRedisChanges,
    discardRedisChanges,
  };
}
