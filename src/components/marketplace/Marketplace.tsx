import { useState, useMemo } from "react";
import { 
  X, 
  Search, 
  Download, 
  Star, 
  ShieldCheck, 
  Zap, 
  Globe, 
  Layout, 
  Database, 
  MessageSquare, 
  DownloadCloud,
  Check,
  Power,
  Trash2,
  Loader2,
  Sparkles
} from "lucide-react";
import { Button, Input, Badge, ScrollArea, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { useUIStore } from "@/stores";
import { useExtensions } from "@/extensions";
import { useToast } from "@/hooks/useToast";

type CategoryFilter = "all" | "theme" | "validator" | "exporter" | "installed";

export function Marketplace() {
  const { showMarketplace, setShowMarketplace } = useUIStore();
  const { toast } = useToast();
  const {
    catalog,
    installedExtensions,
    featuredExtensions,
    isLoading,
    install,
    uninstall,
    enable,
    disable,
  } = useExtensions();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  // Filter extensions based on search and category
  const filteredExtensions = useMemo(() => {
    let extensions = catalog;

    // Filter by category
    if (category === "installed") {
      extensions = extensions.filter((e) => e.installed);
    } else if (category !== "all") {
      extensions = extensions.filter((e) => e.category === category);
    }

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      extensions = extensions.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.author.toLowerCase().includes(query)
      );
    }

    return extensions;
  }, [catalog, category, search]);

  const handleInstall = async (extensionId: string, name: string) => {
    try {
      await install(extensionId);
      toast({
        title: "Extension installed",
        description: `${name} has been installed and enabled.`,
      });
    } catch (error) {
      toast({
        title: "Installation failed",
        description: error instanceof Error ? error.message : "Failed to install extension",
        variant: "destructive",
      });
    }
  };

  const handleUninstall = async (extensionId: string, name: string) => {
    try {
      await uninstall(extensionId);
      toast({
        title: "Extension uninstalled",
        description: `${name} has been removed.`,
      });
    } catch (error) {
      toast({
        title: "Uninstall failed",
        description: error instanceof Error ? error.message : "Failed to uninstall extension",
        variant: "destructive",
      });
    }
  };

  const handleEnable = (extensionId: string, name: string) => {
    enable(extensionId);
    toast({
      title: "Extension enabled",
      description: `${name} is now active.`,
    });
  };

  const handleDisable = (extensionId: string, name: string) => {
    disable(extensionId);
    toast({
      title: "Extension disabled",
      description: `${name} has been disabled.`,
    });
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "ai":
        return <MessageSquare className="h-6 w-6 text-primary" />;
      case "validator":
        return <ShieldCheck className="h-6 w-6 text-primary" />;
      case "theme":
        return <Layout className="h-6 w-6 text-primary" />;
      case "exporter":
        return <Database className="h-6 w-6 text-primary" />;
      default:
        return <Zap className="h-6 w-6 text-primary" />;
    }
  };

  if (!showMarketplace) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 p-4 md:p-8">
      <div className="flex h-full w-full max-w-6xl flex-col rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DownloadCloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Extension Marketplace</h2>
              <p className="text-sm text-muted-foreground">
                Extend dbfordevs with themes, AI, and more
                <span className="ml-2 text-xs">
                  ({installedExtensions.length} installed)
                </span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowMarketplace(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-4 border-b bg-muted/30 px-6 py-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              className="pl-10" 
              placeholder="Search extensions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Tabs value={category} onValueChange={(v) => setCategory(v as CategoryFilter)} className="w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="installed">
                Installed
                {installedExtensions.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {installedExtensions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="theme">Themes</TabsTrigger>
              <TabsTrigger value="validator">Validators</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Categories Sidebar */}
          <div className="hidden md:block w-64 border-r bg-muted/10 p-4">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Browse
            </h3>
            <nav className="space-y-1">
              <Button 
                variant="ghost" 
                className={`w-full justify-start gap-2 text-sm ${category === "all" ? "bg-primary/5 text-primary font-medium" : ""}`}
                onClick={() => setCategory("all")}
              >
                <Globe className="h-4 w-4" />
                All Extensions
              </Button>
              <Button 
                variant="ghost" 
                className={`w-full justify-start gap-2 text-sm ${category === "installed" ? "bg-primary/5 text-primary font-medium" : ""}`}
                onClick={() => setCategory("installed")}
              >
                <Check className="h-4 w-4" />
                Installed
                {installedExtensions.length > 0 && (
                  <Badge variant="outline" className="ml-auto h-5 px-1.5 text-[10px]">
                    {installedExtensions.length}
                  </Badge>
                )}
              </Button>
              
              <div className="my-4 h-px bg-border" />
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categories
              </h3>
              
              <Button 
                variant="ghost" 
                className={`w-full justify-start gap-2 text-sm ${category === "theme" ? "bg-primary/5 text-primary font-medium" : ""}`}
                onClick={() => setCategory("theme")}
              >
                <Layout className="h-4 w-4" />
                Themes
              </Button>
              <Button 
                variant="ghost" 
                className={`w-full justify-start gap-2 text-sm ${category === "validator" ? "bg-primary/5 text-primary font-medium" : ""}`}
                onClick={() => setCategory("validator")}
              >
                <ShieldCheck className="h-4 w-4" />
                Validators
              </Button>
            </nav>

            {/* Featured Section */}
            {featuredExtensions.length > 0 && (
              <>
                <div className="my-4 h-px bg-border" />
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Featured
                </h3>
                <div className="space-y-2">
                  {featuredExtensions.slice(0, 3).map((ext) => (
                    <div 
                      key={ext.id}
                      className="rounded-lg border border-border/50 bg-background/50 p-2 text-xs"
                    >
                      <div className="font-medium truncate">{ext.name}</div>
                      <div className="text-muted-foreground truncate">{ext.author}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Extension Grid */}
          <ScrollArea className="flex-1 p-6">
            {filteredExtensions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No extensions found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredExtensions.map((ext) => {
                  const installed = ext.installed;
                  const enabled = ext.enabled;

                  return (
                    <div 
                      key={ext.id} 
                      className={`group flex flex-col rounded-xl border bg-background p-5 transition-all hover:shadow-md ${
                        installed 
                          ? enabled 
                            ? "border-primary/30 bg-primary/5" 
                            : "border-muted-foreground/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                          installed && enabled ? "bg-primary/10" : "bg-muted"
                        } group-hover:bg-primary/10`}>
                          {getCategoryIcon(ext.category)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {ext.isFeatured && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                          {installed && (
                            <Badge 
                              variant={enabled ? "default" : "secondary"}
                              className={enabled ? "bg-green-500/10 text-green-600" : ""}
                            >
                              {enabled ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Active
                                </>
                              ) : (
                                "Disabled"
                              )}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold">{ext.name}</h4>
                          {ext.isOfficial && (
                            <Badge 
                              variant="outline" 
                              className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-tighter bg-primary/5 text-primary border-primary/20"
                            >
                              Official
                            </Badge>
                          )}
                        </div>
                        <p className="mb-4 text-xs text-muted-foreground line-clamp-2">
                          {ext.description}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-border/50">
                        <div className="mb-4 flex items-center justify-between text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              {ext.rating}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {ext.downloads}
                            </span>
                          </div>
                          <span className="font-mono">v{ext.version}</span>
                        </div>
                        
                        {/* Action Buttons */}
                        {!installed ? (
                          <Button 
                            className="w-full" 
                            size="sm"
                            onClick={() => handleInstall(ext.id, ext.name)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            Install
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            {enabled ? (
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => handleDisable(ext.id, ext.name)}
                              >
                                <Power className="mr-1.5 h-3.5 w-3.5" />
                                Disable
                              </Button>
                            ) : (
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => handleEnable(ext.id, ext.name)}
                              >
                                <Power className="mr-1.5 h-3.5 w-3.5" />
                                Enable
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleUninstall(ext.id, ext.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
