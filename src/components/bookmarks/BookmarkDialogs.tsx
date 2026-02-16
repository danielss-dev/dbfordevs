import { useCallback } from "react";
import { SaveBookmarkDialog } from "./SaveBookmarkDialog";
import { BookmarkManagerDialog } from "./BookmarkManagerDialog";
import { TemplateVariableDialog } from "./TemplateVariableDialog";
import { useQueryStore, selectActiveTab } from "@/stores/query";

export function BookmarkDialogs() {
  const activeTab = useQueryStore(selectActiveTab);
  const updateTabContent = useQueryStore((s) => s.updateTabContent);
  const setPendingBookmarkQuery = useQueryStore((s) => s.setPendingBookmarkQuery);

  // Load bookmark into the active query tab
  const handleLoadBookmark = useCallback(
    (sql: string) => {
      if (activeTab && activeTab.type === "query") {
        updateTabContent(activeTab.id, sql);
      }
    },
    [activeTab, updateTabContent]
  );

  // Load bookmark into editor AND trigger execution
  const handleExecuteBookmark = useCallback(
    (sql: string) => {
      if (activeTab && activeTab.type === "query") {
        updateTabContent(activeTab.id, sql);
        setPendingBookmarkQuery({ sql, tabId: activeTab.id });
      }
    },
    [activeTab, updateTabContent, setPendingBookmarkQuery]
  );

  return (
    <>
      <SaveBookmarkDialog />
      <BookmarkManagerDialog onLoadBookmark={handleLoadBookmark} />
      <TemplateVariableDialog onApply={handleLoadBookmark} onExecute={handleExecuteBookmark} />
    </>
  );
}
