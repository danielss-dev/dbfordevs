import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  SortAsc,
  Loader2,
  Edit2,
  Copy,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui";
import { useMongoDB, useToast } from "@/hooks";
import { useMongoDBStore, useQueryStore } from "@/stores";
import { MongoDocumentViewer } from "./MongoDocumentViewer";
import { MongoDocumentEditor } from "./MongoDocumentEditor";
import type { Tab } from "@/types";

interface MongoBrowserProps {
  connectionId: string;
  database: string;
  collection: string;
}

export function MongoBrowser({ connectionId, database, collection }: MongoBrowserProps) {
  const { findDocuments, deleteDocument, insertDocument } = useMongoDB();
  const { toast } = useToast();
  const { addTab, tabs, setActiveTab } = useQueryStore();
  const {
    documentsByCollection,
    documentCountByCollection,
    filterByCollection,
    sortByCollection,
    skipByCollection,
    limitByCollection,
    loadingDocuments,
    setFilter,
    setSort,
    setSkip,
  } = useMongoDBStore();

  const collectionKey = `${connectionId}:${database}:${collection}`;
  const documents = documentsByCollection[collectionKey] || [];
  const totalCount = documentCountByCollection[collectionKey] || 0;
  const filter = filterByCollection[collectionKey] || "";
  const sort = sortByCollection[collectionKey] || "";
  const skip = skipByCollection[collectionKey] || 0;
  const limit = limitByCollection[collectionKey] || 50;

  const [filterInput, setFilterInput] = useState(filter);
  const [sortInput, setSortInput] = useState(sort);
  const [selectedDoc, setSelectedDoc] = useState<unknown | null>(null);
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<unknown | null>(null);

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(skip / limit) + 1;

  // Load documents on mount or when filter/sort/pagination changes
  useEffect(() => {
    loadDocuments();
  }, [connectionId, database, collection, skip, limit]);

  const loadDocuments = useCallback(() => {
    findDocuments(
      connectionId,
      database,
      collection,
      filter || undefined,
      undefined,
      sort || undefined,
      skip,
      limit
    );
  }, [connectionId, database, collection, filter, sort, skip, limit, findDocuments]);

  const handleRefresh = () => {
    loadDocuments();
  };

  const handleApplyFilter = () => {
    setFilter(connectionId, database, collection, filterInput);
    setSkip(connectionId, database, collection, 0);
    findDocuments(
      connectionId,
      database,
      collection,
      filterInput || undefined,
      undefined,
      sort || undefined,
      0,
      limit
    );
  };

  const handleApplySort = () => {
    setSort(connectionId, database, collection, sortInput);
    findDocuments(
      connectionId,
      database,
      collection,
      filter || undefined,
      undefined,
      sortInput || undefined,
      skip,
      limit
    );
  };

  const handlePrevPage = () => {
    const newSkip = Math.max(0, skip - limit);
    setSkip(connectionId, database, collection, newSkip);
  };

  const handleNextPage = () => {
    const newSkip = skip + limit;
    if (newSkip < totalCount) {
      setSkip(connectionId, database, collection, newSkip);
    }
  };

  const handleViewDocument = (doc: unknown) => {
    setSelectedDoc(doc);
    setShowViewDialog(true);
  };

  const handleEditDocument = (doc: unknown) => {
    const docAny = doc as { _id?: { $oid?: string } | string };
    const id = typeof docAny._id === "object" && docAny._id?.$oid
      ? docAny._id.$oid
      : String(docAny._id || "");

    const tabId = `mongodb-document-${connectionId}-${database}-${collection}-${id}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: `Doc: ${id.substring(0, 8)}...`,
        type: "mongodb-document",
        connectionId,
        mongoDatabase: database,
        mongoCollection: collection,
        mongoDocumentId: JSON.stringify(doc),
      } as Tab);
    }
  };

  const handleDeleteClick = (doc: unknown) => {
    setDocToDelete(doc);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;

    const docAny = docToDelete as { _id?: { $oid?: string } | string };
    const id = typeof docAny._id === "object" && docAny._id?.$oid
      ? docAny._id.$oid
      : String(docAny._id || "");

    const filterJson = JSON.stringify({ _id: { $oid: id } });
    const result = await deleteDocument(connectionId, database, collection, filterJson);

    if (result > 0) {
      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      });
      loadDocuments();
    } else {
      toast({
        title: "Delete failed",
        description: "Failed to delete the document.",
        variant: "destructive",
      });
    }

    setShowDeleteConfirm(false);
    setDocToDelete(null);
  };

  const handleInsertDocument = async (docJson: string) => {
    const result = await insertDocument(connectionId, database, collection, docJson);

    if (result) {
      toast({
        title: "Document inserted",
        description: `Document created with ID: ${result}`,
      });
      loadDocuments();
      setShowInsertDialog(false);
    } else {
      toast({
        title: "Insert failed",
        description: "Failed to insert the document.",
        variant: "destructive",
      });
    }
  };

  const handleCopyDocument = (doc: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    toast({
      title: "Copied",
      description: "Document copied to clipboard.",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b p-2">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleRefresh}
                disabled={loadingDocuments}
              >
                <RefreshCw className={cn("h-4 w-4", loadingDocuments && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowInsertDialog(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Document</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder='Filter: { "field": "value" }'
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              className="h-8 w-64 text-xs font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
            />
            <Button variant="outline" size="sm" className="h-8" onClick={handleApplyFilter}>
              Apply
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <SortAsc className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder='Sort: { "field": 1 }'
              value={sortInput}
              onChange={(e) => setSortInput(e.target.value)}
              className="h-8 w-48 text-xs font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleApplySort()}
            />
            <Button variant="outline" size="sm" className="h-8" onClick={handleApplySort}>
              Sort
            </Button>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {totalCount} docs | Page {currentPage} of {totalPages || 1}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handlePrevPage}
              disabled={skip === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleNextPage}
              disabled={skip + limit >= totalCount}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-auto p-2">
        {loadingDocuments ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p>No documents found</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowInsertDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Insert Document
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc, index) => {
              const docAny = doc as { _id?: { $oid?: string } | string };
              const id = typeof docAny._id === "object" && docAny._id?.$oid
                ? docAny._id.$oid
                : String(docAny._id || index);

              return (
                <div
                  key={id}
                  className="group rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <pre className="flex-1 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(doc, null, 2).substring(0, 500)}
                      {JSON.stringify(doc, null, 2).length > 500 && "..."}
                    </pre>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEditDocument(doc)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleCopyDocument(doc)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(doc)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Document Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>View Document</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            <MongoDocumentViewer document={selectedDoc} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Insert Document Dialog */}
      <Dialog open={showInsertDialog} onOpenChange={setShowInsertDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Insert Document</DialogTitle>
          </DialogHeader>
          <MongoDocumentEditor onSave={handleInsertDocument} onCancel={() => setShowInsertDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this document? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
