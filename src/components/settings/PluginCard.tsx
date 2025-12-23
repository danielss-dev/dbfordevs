import { MessageSquare, ShieldCheck, Database, Download, Star, Layout as LayoutIcon } from "lucide-react";
import { Button } from "@/components/ui";
import type { PluginData } from "@/data/plugins";

interface PluginCardProps {
  plugin: PluginData;
}

export function PluginCard({ plugin }: PluginCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "AI":
        return <MessageSquare className="h-6 w-6 text-primary" />;
      case "Validators":
        return <ShieldCheck className="h-6 w-6 text-primary" />;
      case "Themes":
        return <LayoutIcon className="h-6 w-6 text-primary" />;
      default:
        return <Database className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-background p-5 transition-all hover:border-primary/50 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/5">
          {getCategoryIcon(plugin.category)}
        </div>
        {plugin.isFeatured && (
          <span className="badge badge-primary bg-primary/10 text-primary hover:bg-primary/20 text-[10px]">
            Featured
          </span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-sm">{plugin.name}</h4>
          {plugin.isOfficial && (
            <span className="badge badge-outline h-5 px-1.5 text-[10px] uppercase font-bold tracking-tighter bg-primary/5 text-primary border-primary/20">
              Official
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-muted-foreground line-clamp-2">{plugin.description}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-border/50">
        <div className="mb-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {plugin.rating}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {plugin.downloads}
            </span>
          </div>
          <span className="font-mono">v{plugin.version}</span>
        </div>
        <Button className="w-full" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Install
        </Button>
      </div>
    </div>
  );
}
