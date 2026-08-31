import { useState, useEffect, useRef, useCallback } from "react";
import {
  Database,
  FolderClosed,
  FolderOpen,
  File,
  Terminal,
  ServerCog,
  Loader2,
  RefreshCw,
  LayoutGrid,
  Trash2,
  Eye,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TreeItem } from "@/components/layout/sidebar/TreeItem";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";
import { useMongoDB, useToast } from "@/hooks";
import { useMongoDBStore, useQueryStore } from "@/stores";
import type { Tab } from "@/types";

interface MongoConnectionContentProps {
  connectionId: string;
}

export function MongoConnectionContent({ connectionId }: MongoConnectionContentProps) {
  const { listDatabases, listCollections, getServerInfo, dropDatabase, dropCollection } = useMongoDB();
  const { addTab, tabs, setActiveTab } = useQueryStore();
  const { toast } = useToast();
  const {
    databasesByConnection,
    collectionsByDb,
    loadingDatabases,
    loadingCollections,
    selectedDatabaseByConnection,
    setSelectedDatabase,
    highlightedItemByConnection,
    clearHighlightedItem,
  } = useMongoDBStore();

  const databases = databasesByConnection[connectionId] || [];
  const selectedDb = selectedDatabaseByConnection[connectionId];
  const highlightedItem = highlightedItemByConnection[connectionId] || null;

  // Refs for scrolling to highlighted items
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Dialog states
  const [dropDbDialog, setDropDbDialog] = useState<string | null>(null);
  const [dropCollDialog, setDropCollDialog] = useState<{ db: string; coll: string } | null>(null);

  // Scroll to highlighted item when it changes
  useEffect(() => {
    if (highlightedItem) {
      const refKey = highlightedItem.type === "database"
        ? `db-${highlightedItem.name}`
        : highlightedItem.type === "collection"
          ? `coll-${highlightedItem.dbName}-${highlightedItem.name}`
          : `idx-${highlightedItem.dbName}-${highlightedItem.collName}-${highlightedItem.name}`;

      if (itemRefs.current[refKey]) {
        // Small delay to allow tree expansion animation
        setTimeout(() => {
          itemRefs.current[refKey]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 100);

        // Clear highlight after animation completes
        setTimeout(() => {
          clearHighlightedItem(connectionId);
        }, 2000);
      }
    }
  }, [highlightedItem, connectionId, clearHighlightedItem]);

  // Callback ref for items
  const setItemRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[key] = el;
  }, []);

  // Load databases on mount
  useEffect(() => {
    listDatabases(connectionId);
    getServerInfo(connectionId);
  }, [connectionId]);

  const handleRefreshDatabases = () => {
    listDatabases(connectionId);
  };

  const handleRefreshCollections = (dbName: string) => {
    listCollections(connectionId, dbName);
  };

  const handleDatabaseClick = async (dbName: string) => {
    setSelectedDatabase(connectionId, dbName);
    const key = `${connectionId}:${dbName}`;
    if (!collectionsByDb[key]) {
      await listCollections(connectionId, dbName);
    }
  };

  const handleCollectionClick = (dbName: string, collectionName: string) => {
    const tabId = `mongodb-browser-${connectionId}-${dbName}-${collectionName}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: collectionName.length > 20 ? collectionName.substring(0, 17) + "..." : collectionName,
        type: "mongodb-browser",
        connectionId,
        mongoDatabase: dbName,
        mongoCollection: collectionName,
      } as Tab);
    }
  };

  const handleOpenShell = () => {
    const tabId = `mongodb-shell-${connectionId}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "Shell",
        type: "mongodb-shell",
        connectionId,
      } as Tab);
    }
  };

  const handleOpenServerInfo = () => {
    const tabId = `mongodb-info-${connectionId}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "Server Info",
        type: "mongodb-info",
        connectionId,
      } as Tab);
    }
  };

  const handleOpenAggregation = (dbName: string, collectionName: string) => {
    const tabId = `mongodb-aggregation-${connectionId}-${dbName}-${collectionName}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: `Aggregate: ${collectionName}`,
        type: "mongodb-aggregation",
        connectionId,
        mongoDatabase: dbName,
        mongoCollection: collectionName,
      } as Tab);
    }
  };

  const handleDropDatabase = async (dbName: string) => {
    const success = await dropDatabase(connectionId, dbName);
    if (success) {
      toast({
        title: "Database dropped",
        description: `Database "${dbName}" has been dropped.`,
      });
      listDatabases(connectionId);
    } else {
      toast({
        title: "Failed to drop database",
        description: `Could not drop database "${dbName}".`,
        variant: "destructive",
      });
    }
    setDropDbDialog(null);
  };

  const handleDropCollection = async (dbName: string, collName: string) => {
    const success = await dropCollection(connectionId, dbName, collName);
    if (success) {
      toast({
        title: "Collection dropped",
        description: `Collection "${collName}" has been dropped.`,
      });
      listCollections(connectionId, dbName);
    } else {
      toast({
        title: "Failed to drop collection",
        description: `Could not drop collection "${collName}".`,
        variant: "destructive",
      });
    }
    setDropCollDialog(null);
  };

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    toast({
      title: "Copied",
      description: `"${name}" copied to clipboard.`,
    });
  };

  return (
    <>
      {/* Databases Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Databases"
              icon={<Database className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              defaultOpen={true}
              count={databases.length}
              rightElement={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshDatabases();
                      }}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loadingDatabases && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh databases</TooltipContent>
                </Tooltip>
              }
            >
              {loadingDatabases ? (
                <div className="ml-8 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                databases.map((db) => {
                  const collections = collectionsByDb[`${connectionId}:${db.name}`] || [];
                  const isExpanded = selectedDb === db.name;
                  const shouldForceOpenDb = highlightedItem && (
                    (highlightedItem.type === "database" && highlightedItem.name === db.name) ||
                    (highlightedItem.type === "collection" && highlightedItem.dbName === db.name) ||
                    (highlightedItem.type === "index" && highlightedItem.dbName === db.name)
                  );
                  const isDbHighlighted = highlightedItem?.type === "database" && highlightedItem.name === db.name;

                  return (
                    <ContextMenu key={db.name}>
                      <ContextMenuTrigger asChild>
                        <div ref={setItemRef(`db-${db.name}`)}>
                          <TreeItem
                            label={db.name}
                            icon={
                              isExpanded || shouldForceOpenDb ? (
                                <FolderOpen className="h-3.5 w-3.5 text-yellow-500" />
                              ) : (
                                <FolderClosed className="h-3.5 w-3.5 text-yellow-500" />
                              )
                            }
                            level={2}
                            count={db.collectionCount}
                            defaultOpen={isExpanded}
                            forceOpen={shouldForceOpenDb || false}
                            isHighlighted={isDbHighlighted}
                            onClick={() => handleDatabaseClick(db.name)}
                          >
                            {loadingCollections ? (
                              <div className="ml-12 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading...</span>
                              </div>
                            ) : (
                              collections.map((coll) => {
                                const isCollHighlighted = highlightedItem?.type === "collection" &&
                                  highlightedItem.dbName === db.name &&
                                  highlightedItem.name === coll.name;

                                return (
                                <ContextMenu key={coll.name}>
                                  <ContextMenuTrigger asChild>
                                    <div ref={setItemRef(`coll-${db.name}-${coll.name}`)}>
                                      <TreeItem
                                        label={coll.name}
                                        icon={<File className="h-3.5 w-3.5 text-green-500" />}
                                        level={3}
                                        count={coll.documentCount}
                                        isHighlighted={isCollHighlighted}
                                        onClick={() => handleCollectionClick(db.name, coll.name)}
                                        rightElement={
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenAggregation(db.name, coll.name);
                                                }}
                                              >
                                                <LayoutGrid className="h-3 w-3" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Aggregation Pipeline</TooltipContent>
                                          </Tooltip>
                                        }
                                      />
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-48">
                                    <ContextMenuItem
                                      onSelect={() => handleCollectionClick(db.name, coll.name)}
                                      className="gap-2"
                                    >
                                      <Eye className="h-4 w-4" />
                                      Browse Documents
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onSelect={() => handleOpenAggregation(db.name, coll.name)}
                                      className="gap-2"
                                    >
                                      <LayoutGrid className="h-4 w-4" />
                                      Aggregation Pipeline
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onSelect={() => handleCopyName(coll.name)}
                                      className="gap-2"
                                    >
                                      <Copy className="h-4 w-4" />
                                      Copy Name
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onSelect={() => setDropCollDialog({ db: db.name, coll: coll.name })}
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Drop Collection
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );})
                            )}
                            {!loadingCollections && collections.length === 0 && (
                              <div className="ml-12 py-1 text-xs text-muted-foreground">No collections</div>
                            )}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem
                          onSelect={() => handleRefreshCollections(db.name)}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh Collections
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => handleCopyName(db.name)}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy Name
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => setDropDbDialog(db.name)}
                          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Drop Database
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              )}
              {!loadingDatabases && databases.length === 0 && (
                <div className="ml-8 py-2 text-xs text-muted-foreground">No databases found</div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleRefreshDatabases} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Databases
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Shell Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Shell"
              icon={<Terminal className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleOpenShell}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleOpenShell} className="gap-2">
            <Terminal className="h-4 w-4" />
            Open Shell
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Server Info Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Server Info"
              icon={<ServerCog className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleOpenServerInfo}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleOpenServerInfo} className="gap-2">
            <ServerCog className="h-4 w-4" />
            View Server Info
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop Database Confirmation Dialog */}
      <AlertDialog open={!!dropDbDialog} onOpenChange={() => setDropDbDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Database</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the database "{dropDbDialog}"? This action cannot be undone
              and will permanently delete all collections and documents in this database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dropDbDialog && handleDropDatabase(dropDbDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Collection Confirmation Dialog */}
      <AlertDialog open={!!dropCollDialog} onOpenChange={() => setDropCollDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the collection "{dropCollDialog?.coll}"? This action cannot
              be undone and will permanently delete all documents in this collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dropCollDialog && handleDropCollection(dropCollDialog.db, dropCollDialog.coll)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
