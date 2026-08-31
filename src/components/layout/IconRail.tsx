import { Rows, Gear } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useUIStore } from "@/stores";

type RailId = "browser" | "settings";

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
          isActive={sidebarOpen}
          onClick={() => {
            if (!sidebarOpen) toggleSidebar();
          }}
        />
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-0.5">
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
