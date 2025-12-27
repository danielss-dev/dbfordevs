/**
 * ChatHistoryPanel
 *
 * Panel showing chat history with time grouping (like Cursor)
 */

import { useState } from "react";
import { X, Search, Plus } from "lucide-react";
import {
  Button,
  Input,
  ScrollArea,
} from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import { groupSessionsByTime } from "@/lib/ai/utils";
import { ChatHistoryItem } from "./ChatHistoryItem";
import { cn } from "@/lib/utils";

interface ChatHistoryPanelProps {
  onClose: () => void;
}

export function ChatHistoryPanel({ onClose }: ChatHistoryPanelProps) {
  const { chatSessions, activeChatSessionId, createNewChatSession, switchChatSession } = useAIStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter sessions by search query
  const filteredSessions = chatSessions.filter((session) => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    const titleMatch = session.title.toLowerCase().includes(searchLower);
    const messageMatch = session.messages.some(msg =>
      msg.content.toLowerCase().includes(searchLower)
    );

    return titleMatch || messageMatch;
  });

  // Group filtered sessions by time
  const groupedSessions = groupSessionsByTime(filteredSessions);

  const handleNewChat = () => {
    createNewChatSession();
  };

  const handleSelectSession = (sessionId: string) => {
    switchChatSession(sessionId);
  };

  return (
    <div
      className={cn(
        "fixed right-[420px] top-0 bottom-0 z-40 flex flex-col",
        "w-[360px] border-l border-border bg-background shadow-xl",
        "animate-in slide-in-from-right duration-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-semibold text-sm">Chat History</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Chat History List */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {chatSessions.length === 0
                  ? "No chats yet"
                  : "No matching chats"}
              </p>
              {chatSessions.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleNewChat}
                >
                  Start a new chat
                </Button>
              )}
            </div>
          ) : (
            <div>
              {Object.entries(groupedSessions).map(([timeLabel, sessions]) => (
                <div key={timeLabel} className="mb-4">
                  {/* Time group label */}
                  <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                    {timeLabel}
                  </div>

                  {/* Chat items in this time group */}
                  <div>
                    {sessions.map((session) => (
                      <ChatHistoryItem
                        key={session.id}
                        session={session}
                        isActive={session.id === activeChatSessionId}
                        onSelect={() => handleSelectSession(session.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
