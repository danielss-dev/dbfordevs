import { X, Search, Download, Star, ShieldCheck, Zap, Globe, Layout, Database, MessageSquare, DownloadCloud } from "lucide-react";
import { Button, Input, Badge, ScrollArea, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { useUIStore } from "@/stores";

const PLUGINS = [
  {
    id: "validator-csharp",
    name: "C# / .NET Validator",
    description: "Validate ADO.NET connection strings for SQL Server, PostgreSQL, and MySQL.",
    version: "1.0.2",
    author: "dbfordevs",
    category: "Validators",
    downloads: "1.2k",
    rating: 4.8,
    isOfficial: true,
  },
  {
    id: "validator-nodejs",
    name: "Node.js Validator",
    description: "Support for pg, mysql2, and mssql connection string formats (URL and JSON).",
    version: "1.1.0",
    author: "dbfordevs",
    category: "Validators",
    downloads: "2.5k",
    rating: 4.9,
    isOfficial: true,
  },
  {
    id: "validator-python",
    name: "Python Validator",
    description: "SQLAlchemy, psycopg2, and PyMySQL connection URL validation.",
    version: "1.0.5",
    author: "dbfordevs",
    category: "Validators",
    downloads: "800",
    rating: 4.7,
    isOfficial: true,
  },
  {
    id: "ai-assistant",
    name: "AI Query Assistant",
    description: "Generate SQL from natural language, optimize slow queries, and explain plans.",
    version: "2.0.1",
    author: "dbfordevs",
    category: "AI",
    downloads: "5.4k",
    rating: 5.0,
    isOfficial: true,
    isFeatured: true,
  },
  {
    id: "exporter-parquet",
    name: "Parquet Exporter",
    description: "Export result sets to Apache Parquet format for big data processing.",
    version: "0.9.0",
    author: "Community",
    category: "Exporters",
    downloads: "300",
    rating: 4.5,
    isOfficial: false,
  },
  {
    id: "theme-nord",
    name: "Nord Theme",
    description: "An arctic, north-bluish color palette for dbfordevs.",
    version: "1.0.0",
    author: "Arctic Ice Studio",
    category: "Themes",
    downloads: "1.5k",
    rating: 4.8,
    isOfficial: false,
  }
];

export function Marketplace() {
  const { showMarketplace, setShowMarketplace } = useUIStore();

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
              <h2 className="text-xl font-bold">Plugin Marketplace</h2>
              <p className="text-sm text-muted-foreground">Extend dbfordevs with specialized tools and integrations</p>
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
            <Input className="pl-10" placeholder="Search plugins, themes, and more..." />
          </div>
          <Tabs defaultValue="all" className="w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="validators">Validators</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
              <TabsTrigger value="exporters">Exporters</TabsTrigger>
              <TabsTrigger value="themes">Themes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Categories Sidebar */}
          <div className="hidden md:block w-64 border-r bg-muted/10 p-4">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</h3>
            <nav className="space-y-1">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm font-medium bg-primary/5 text-primary">
                <Globe className="h-4 w-4" />
                Discovery
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                <ShieldCheck className="h-4 w-4" />
                Featured
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                <Zap className="h-4 w-4" />
                Trending
              </Button>
              <div className="my-4 h-px bg-border" />
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                <Database className="h-4 w-4" />
                Validators
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                AI Assistant
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                <Layout className="h-4 w-4" />
                Themes
              </Button>
            </nav>
          </div>

          {/* Plugin Grid */}
          <ScrollArea className="flex-1 p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {PLUGINS.map((plugin) => (
                <div key={plugin.id} className="group flex flex-col rounded-xl border border-border bg-background p-5 transition-all hover:border-primary/50 hover:shadow-md">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/5">
                      {plugin.category === "AI" ? <MessageSquare className="h-6 w-6 text-primary" /> : 
                       plugin.category === "Validators" ? <ShieldCheck className="h-6 w-6 text-primary" /> :
                       plugin.category === "Themes" ? <Layout className="h-6 w-6 text-primary" /> :
                       <Database className="h-6 w-6 text-primary" />}
                    </div>
                    {plugin.isFeatured && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">Featured</Badge>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold">{plugin.name}</h4>
                      {plugin.isOfficial && (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-tighter bg-primary/5 text-primary border-primary/20">Official</Badge>
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
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

