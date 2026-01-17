import type { Tab } from "@/types";
import { useQueryStore } from "@/stores";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { X, Pin, PinOff } from "lucide-react";

interface TabContextMenuProps {
  tab: Tab;
  children: React.ReactNode;
}

export function TabContextMenu({ tab, children }: TabContextMenuProps) {
  const { tabs, removeTab, closeOtherTabs, closeTabsToRight, closeAllTabs, togglePinTab } =
    useQueryStore();

  const tabIndex = tabs.findIndex((t) => t.id === tab.id);
  const unpinnedTabsCount = tabs.filter((t) => !t.isPinned).length;
  const tabsToRightCount = tabs.slice(tabIndex + 1).filter((t) => !t.isPinned).length;

  const handleClose = () => {
    if (!tab.isPinned) {
      removeTab(tab.id);
    }
  };

  const handleCloseOthers = () => {
    closeOtherTabs(tab.id);
  };

  const handleCloseToRight = () => {
    closeTabsToRight(tab.id);
  };

  const handleCloseAll = () => {
    closeAllTabs();
  };

  const handleTogglePin = () => {
    togglePinTab(tab.id);
  };

  // Disable conditions
  const isCloseDisabled = tab.isPinned;
  const isCloseOthersDisabled = unpinnedTabsCount <= 1 && !tab.isPinned;
  const isCloseToRightDisabled = tabsToRightCount === 0;
  const isCloseAllDisabled = unpinnedTabsCount === 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[200px]">
        <ContextMenuItem
          onClick={handleClose}
          disabled={isCloseDisabled}
        >
          <X className="h-4 w-4 mr-2" />
          <span className="flex-1">Close</span>
          <ContextMenuShortcut>⌃W</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCloseOthers}
          disabled={isCloseOthersDisabled}
        >
          <span className="flex-1">Close Others</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCloseToRight}
          disabled={isCloseToRightDisabled}
        >
          <span className="flex-1">Close to the Right</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCloseAll}
          disabled={isCloseAllDisabled}
        >
          <span className="flex-1">Close All</span>
          <ContextMenuShortcut>⌃⇧W</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleTogglePin}>
          {tab.isPinned ? (
            <PinOff className="h-4 w-4 mr-2" />
          ) : (
            <Pin className="h-4 w-4 mr-2" />
          )}
          <span className="flex-1">{tab.isPinned ? "Unpin Tab" : "Pin Tab"}</span>
          <ContextMenuShortcut>⌃⇧P</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
