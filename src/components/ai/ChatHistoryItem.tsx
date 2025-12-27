/**
 * ChatHistoryItem
 *
 * Individual chat item in the chat history sidebar
 */

import { useState } from "react";
import { Edit2, Trash2, Star } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import type { AIChatSession } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

interface ChatHistoryItemProps {
  session: AIChatSession;
  isActive: boolean;
  onSelect: () => void;
}

export function ChatHistoryItem({ session, isActive, onSelect }: ChatHistoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const { updateChatSessionTitle, deleteChatSession, toggleSessionFavorite } = useAIStore();
  const { toast } = useToast();

  const handleSaveTitle = () => {
    if (editTitle.trim()) {
      updateChatSessionTitle(session.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setEditTitle(session.title);
      setIsEditing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteChatSession(session.id);
    toast({
      title: "Chat deleted",
      description: `"${session.title}" has been removed from your history.`,
    });
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSessionFavorite(session.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  };

  return (
    <div
      className={cn(
        "group relative px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors",
        isActive && "bg-muted border-l-2 border-primary"
      )}
      onClick={onSelect}
    >
      {isEditing ? (
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {session.isFavorite && (
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
            )}
            <span className="text-sm truncate flex-1">{session.title}</span>
          </div>

          {/* Hover actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent"
              onClick={handleToggleFavorite}
              title={session.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={cn(
                "h-3 w-3",
                session.isFavorite && "fill-yellow-400 text-yellow-400"
              )} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent"
              onClick={handleEdit}
              title="Edit title"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDelete}
              title="Delete chat"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
