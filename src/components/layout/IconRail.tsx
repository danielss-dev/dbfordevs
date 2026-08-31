import {
  Rows,
  TerminalWindow,
  Sparkle,
  TreeStructure,
  GitDiff,
  Star,
  UploadSimple,
  LockSimple,
  Gear,
  Sun,
  Moon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import {
  useUIStore,
  useQueryStore,
  useConnectionsStore,
  selectActiveConnection,
  useDiffStore,
} from "@/stores";
import { useAIStore } from "@/lib/ai/store";

type RailId =
  | "browser"
  | "query"
  | "ai"
  | "schema"
  | "diff"
  | "bookmarks"
  | "import"
  | "security"
  | "theme"
  | "settings";

interface RailButtonProps {
  id: RailId;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  badge?: boolean;
}

function RailButton({ icon, label, isActive, onClick }: RailButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            isActive && "bg-[hsl(var(--sel))] text-primary"
          )}
        >
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary"
            />
          )}
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function IconRail() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openSettingsWithTab = useUIStore((s) => s.openSettingsWithTab);
  const openBookmarkManager = useUIStore((s) => s.openBookmarkManager);
  const toggleRightPanelTab = useUIStore((s) => s.toggleRightPanelTab);
  const rightPanelTab = useUIStore((s) => s.rightPanelTab);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const openConnectionModal = useUIStore((s) => s.openConnectionModal);

  const addTab = useQueryStore((s) => s.addTab);
  const tabs = useQueryStore((s) => s.tabs);
  const setActiveTab = useQueryStore((s) => s.setActiveTab);
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const openSchemaDiffDialog = useDiffStore((s) => s.openSchemaDiffDialog);
  const setPanelOpen = useAIStore((s) => s.setPanelOpen);
  const aiEnabled = useAIStore((s) => s.settings.aiEnabled ?? true);

  const isDark =
    theme === "dark" ||
    theme === "classic-dark" ||
    theme === "nordic-dark" ||
    theme === "solarized-dark" ||
    theme === "one-dark" ||
    theme === "high-contrast" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const handleNewQuery = () => {
    if (!activeConnection) {
      openConnectionModal();
      return;
    }
    if (activeConnection.databaseType === "redis") {
      const tabId = `redis-cli-${activeConnection.id}`;
      const existing = tabs.find((t) => t.id === tabId);
      if (existing) {
        setActiveTab(tabId);
      } else {
        addTab({
          id: tabId,
          title: "CLI",
          type: "redis-cli",
          connectionId: activeConnection.id,
        });
      }
      return;
    }
    if (activeConnection.databaseType === "mongodb") {
      const tabId = `mongodb-shell-${activeConnection.id}`;
      const existing = tabs.find((t) => t.id === tabId);
      if (existing) {
        setActiveTab(tabId);
      } else {
        addTab({
          id: tabId,
          title: "Shell",
          type: "mongodb-shell",
          connectionId: activeConnection.id,
        });
      }
      return;
    }
    if (activeConnection.databaseType === "cassandra") {
      const tabId = `cassandra-shell-${activeConnection.id}`;
      const existing = tabs.find((t) => t.id === tabId);
      if (existing) {
        setActiveTab(tabId);
      } else {
        addTab({
          id: tabId,
          title: "CQL Shell",
          type: "cassandra-shell",
          connectionId: activeConnection.id,
        });
      }
      return;
    }
    addTab({
      id: crypto.randomUUID(),
      title: `Query ${tabs.filter((t) => t.type === "query").length + 1}`,
      type: "query",
      connectionId: activeConnection.id,
      content: "",
    });
  };

  const handleThemeToggle = () => {
    if (theme === "system") {
      setTheme(isDark ? "light" : "dark");
    } else if (
      theme === "dark" ||
      theme === "classic-dark" ||
      theme === "nordic-dark" ||
      theme === "solarized-dark" ||
      theme === "one-dark" ||
      theme === "high-contrast"
    ) {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const handleImport = () => {
    // Prefer import from an active table grid; otherwise open bookmarks import surface
    window.dispatchEvent(new CustomEvent("dbfordevs:open-import"));
  };

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-11 shrink-0 flex-col items-center border-r border-border bg-[hsl(var(--sidebar-background))] py-2"
    >
      <div className="flex flex-col items-center gap-0.5">
        <RailButton
          id="browser"
          icon={<Rows weight="regular" className="h-[18px] w-[18px]" />}
          label="Connections"
          isActive={sidebarOpen && rightPanelTab !== "ai" && rightPanelTab !== "schema-search"}
          onClick={() => {
            if (!sidebarOpen) toggleSidebar();
          }}
        />
        <RailButton
          id="query"
          icon={<TerminalWindow weight="regular" className="h-[18px] w-[18px]" />}
          label="SQL / Query"
          onClick={handleNewQuery}
        />
        {aiEnabled && (
          <RailButton
            id="ai"
            icon={<Sparkle weight="regular" className="h-[18px] w-[18px]" />}
            label="AI Assistant"
            isActive={rightPanelTab === "ai"}
            onClick={() => {
              toggleRightPanelTab("ai");
              setPanelOpen(true);
            }}
          />
        )}
        <RailButton
          id="schema"
          icon={<TreeStructure weight="regular" className="h-[18px] w-[18px]" />}
          label="Schema Search"
          isActive={rightPanelTab === "schema-search"}
          onClick={() => toggleRightPanelTab("schema-search")}
        />
        <RailButton
          id="diff"
          icon={<GitDiff weight="regular" className="h-[18px] w-[18px]" />}
          label="Schema Diff"
          onClick={() => openSchemaDiffDialog()}
        />
        <RailButton
          id="bookmarks"
          icon={<Star weight="regular" className="h-[18px] w-[18px]" />}
          label="Bookmarks"
          onClick={() => openBookmarkManager()}
        />
        <RailButton
          id="import"
          icon={<UploadSimple weight="regular" className="h-[18px] w-[18px]" />}
          label="Import"
          onClick={handleImport}
        />
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-0.5">
        <RailButton
          id="security"
          icon={<LockSimple weight="regular" className="h-[18px] w-[18px]" />}
          label="SSH · SSL"
          onClick={() => openConnectionModal()}
        />
        <RailButton
          id="theme"
          icon={
            isDark ? (
              <Sun weight="regular" className="h-[18px] w-[18px]" />
            ) : (
              <Moon weight="regular" className="h-[18px] w-[18px]" />
            )
          }
          label={isDark ? "Light theme" : "Dark theme"}
          onClick={handleThemeToggle}
        />
        <RailButton
          id="settings"
          icon={<Gear weight="regular" className="h-[18px] w-[18px]" />}
          label="Settings"
          onClick={() => openSettingsWithTab("general")}
        />
      </div>
    </nav>
  );
}
