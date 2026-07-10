import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  Button,
  Input,
  ScrollArea,
} from "@/components/ui";
import { useThemesStore, createDefaultCustomTheme } from "@/stores/themes";
import { useToast } from "@/hooks/useToast";
import type { CustomTheme, BuiltInThemeId, ThemeExportFormat } from "@/types/theme";
import { ThemeEditor } from "./ThemeEditor";
import { ThemePreview } from "./ThemePreview";
import { validateThemeExport } from "@/lib/themes/validation";
import { cn } from "@/lib/utils";
import {
  Palette,
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  Search,
  Moon,
  Sun,
  Monitor,
  Eye,
  Check,
  X,
} from "lucide-react";
import { save, open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

interface ThemeManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Built-in theme info for display
 */
const BUILT_IN_THEMES: { id: BuiltInThemeId; name: string; icon: React.ReactNode; baseTheme: "light" | "dark" }[] = [
  { id: "system", name: "System", icon: <Monitor className="h-4 w-4" />, baseTheme: "light" },
  { id: "light", name: "Light", icon: <Sun className="h-4 w-4" />, baseTheme: "light" },
  { id: "dark", name: "Dark", icon: <Moon className="h-4 w-4" />, baseTheme: "dark" },
  { id: "nordic-dark", name: "Nordic Dark", icon: <Moon className="h-4 w-4 text-[#88C0D0]" />, baseTheme: "dark" },
  { id: "nordic-light", name: "Nordic Light", icon: <Sun className="h-4 w-4 text-[#5E81AC]" />, baseTheme: "light" },
  { id: "solarized-dark", name: "Solarized Dark", icon: <Moon className="h-4 w-4 text-[#268bd2]" />, baseTheme: "dark" },
  { id: "solarized-light", name: "Solarized Light", icon: <Sun className="h-4 w-4 text-[#b58900]" />, baseTheme: "light" },
  { id: "one-dark", name: "One Dark", icon: <Palette className="h-4 w-4 text-[#61afef]" />, baseTheme: "dark" },
  { id: "classic-light", name: "Classic Light", icon: <Sun className="h-4 w-4 text-blue-500" />, baseTheme: "light" },
  { id: "classic-dark", name: "Classic Dark", icon: <Moon className="h-4 w-4 text-blue-400" />, baseTheme: "dark" },
  { id: "high-contrast", name: "High Contrast", icon: <Eye className="h-4 w-4 text-yellow-400" />, baseTheme: "dark" },
];

type SelectedTheme =
  | { type: "builtin"; id: BuiltInThemeId }
  | { type: "custom"; theme: CustomTheme };

export function ThemeManagerDialog({ open, onOpenChange }: ThemeManagerDialogProps) {
  const { customThemes, addTheme, updateTheme, removeTheme, duplicateTheme, exportTheme, importTheme } =
    useThemesStore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<SelectedTheme | null>(null);
  const [editedTheme, setEditedTheme] = useState<CustomTheme | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeBase, setNewThemeBase] = useState<"light" | "dark">("dark");

  // Filter themes based on search
  const filteredBuiltIn = useMemo(() => {
    if (!searchQuery) return BUILT_IN_THEMES;
    const query = searchQuery.toLowerCase();
    return BUILT_IN_THEMES.filter((t) => t.name.toLowerCase().includes(query));
  }, [searchQuery]);

  const filteredCustom = useMemo(() => {
    if (!searchQuery) return customThemes;
    const query = searchQuery.toLowerCase();
    return customThemes.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
    );
  }, [searchQuery, customThemes]);

  // Handle theme selection
  const handleSelectBuiltIn = useCallback((id: BuiltInThemeId) => {
    setSelectedTheme({ type: "builtin", id });
    setEditedTheme(null);
  }, []);

  const handleSelectCustom = useCallback((theme: CustomTheme) => {
    setSelectedTheme({ type: "custom", theme });
    setEditedTheme({ ...theme });
  }, []);

  // Create new theme
  const handleCreateTheme = useCallback(() => {
    if (!newThemeName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your theme.",
        variant: "destructive",
      });
      return;
    }

    const themeData = createDefaultCustomTheme(newThemeName.trim(), newThemeBase);
    const id = addTheme(themeData);
    const newTheme = useThemesStore.getState().getThemeById(id);

    if (newTheme) {
      setSelectedTheme({ type: "custom", theme: newTheme });
      setEditedTheme({ ...newTheme });
    }

    setIsCreating(false);
    setNewThemeName("");

    toast({
      title: "Theme created",
      description: `"${newThemeName}" has been created. Start customizing it!`,
    });
  }, [newThemeName, newThemeBase, addTheme, toast]);

  // Save edited theme
  const handleSaveTheme = useCallback(() => {
    if (!editedTheme) return;

    updateTheme(editedTheme.id, editedTheme);
    setSelectedTheme({ type: "custom", theme: editedTheme });

    toast({
      title: "Theme saved",
      description: `"${editedTheme.name}" has been updated.`,
    });
  }, [editedTheme, updateTheme, toast]);

  // Duplicate theme
  const handleDuplicateTheme = useCallback(
    (theme: CustomTheme) => {
      const newId = duplicateTheme(theme.id, `${theme.name} (Copy)`);
      if (newId) {
        const newTheme = useThemesStore.getState().getThemeById(newId);
        if (newTheme) {
          setSelectedTheme({ type: "custom", theme: newTheme });
          setEditedTheme({ ...newTheme });
        }
        toast({
          title: "Theme duplicated",
          description: `Created a copy of "${theme.name}".`,
        });
      }
    },
    [duplicateTheme, toast]
  );

  // Delete theme
  const handleDeleteTheme = useCallback(
    (theme: CustomTheme) => {
      removeTheme(theme.id);
      if (selectedTheme?.type === "custom" && selectedTheme.theme.id === theme.id) {
        setSelectedTheme(null);
        setEditedTheme(null);
      }
      toast({
        title: "Theme deleted",
        description: `"${theme.name}" has been removed.`,
      });
    },
    [removeTheme, selectedTheme, toast]
  );

  // Export theme
  const handleExportTheme = useCallback(
    async (theme: CustomTheme) => {
      const exportData = exportTheme(theme.id);
      if (!exportData) return;

      try {
        const filePath = await save({
          filters: [{ name: "Theme Files", extensions: ["json"] }],
          defaultPath: `${theme.name.replace(/\s+/g, "-").toLowerCase()}.dbfd-theme.json`,
        });

        if (filePath) {
          await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
          toast({
            title: "Theme exported",
            description: `"${theme.name}" has been exported.`,
          });
        }
      } catch (error) {
        toast({
          title: "Export failed",
          description: String(error),
          variant: "destructive",
        });
      }
    },
    [exportTheme, toast]
  );

  // Import theme
  const handleImportTheme = useCallback(async () => {
    try {
      const filePath = await openFileDialog({
        filters: [{ name: "Theme Files", extensions: ["json"] }],
        multiple: false,
      });

      if (!filePath) return;

      const content = await readTextFile(filePath as string);
      const data = JSON.parse(content) as ThemeExportFormat;

      const validation = validateThemeExport(data);
      if (!validation.valid) {
        toast({
          title: "Invalid theme file",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      const result = importTheme(data);
      if (result.themeId) {
        const imported = useThemesStore.getState().getThemeById(result.themeId);
        if (imported) {
          setSelectedTheme({ type: "custom", theme: imported });
          setEditedTheme({ ...imported });
        }
        toast({
          title: "Theme imported",
          description: `"${data.theme.name}" has been imported.`,
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: String(error),
        variant: "destructive",
      });
    }
  }, [importTheme, toast]);

  // Check if theme has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!editedTheme || selectedTheme?.type !== "custom") return false;
    return JSON.stringify(editedTheme) !== JSON.stringify(selectedTheme.theme);
  }, [editedTheme, selectedTheme]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[700px] p-0 gap-0 overflow-hidden flex flex-col">
        <div className="flex flex-1 min-h-0">
          {/* Left Panel - Theme List */}
          <div className="w-72 border-r border-border flex flex-col bg-muted/30">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Theme Manager</h2>
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search themes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {/* Theme List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-4">
                {/* Built-in Themes */}
                <div>
                  <div className="micro-label px-2 py-1">
                    Built-in Themes
                  </div>
                  <div className="space-y-0.5">
                    {filteredBuiltIn.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleSelectBuiltIn(theme.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                          selectedTheme?.type === "builtin" && selectedTheme.id === theme.id
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50 text-foreground"
                        )}
                      >
                        {theme.icon}
                        <span>{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Themes */}
                <div>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="micro-label">
                      Custom Themes
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5"
                      onClick={() => setIsCreating(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Create new theme form */}
                  {isCreating && (
                    <div className="mx-2 mb-2 p-2 rounded-md border border-border bg-card space-y-2">
                      <Input
                        placeholder="Theme name"
                        value={newThemeName}
                        onChange={(e) => setNewThemeName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          variant={newThemeBase === "dark" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-6 text-xs"
                          onClick={() => setNewThemeBase("dark")}
                        >
                          <Moon className="h-3 w-3 mr-1" />
                          Dark
                        </Button>
                        <Button
                          variant={newThemeBase === "light" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-6 text-xs"
                          onClick={() => setNewThemeBase("light")}
                        >
                          <Sun className="h-3 w-3 mr-1" />
                          Light
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-6"
                          onClick={() => {
                            setIsCreating(false);
                            setNewThemeName("");
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-6"
                          onClick={handleCreateTheme}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Create
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Custom theme list */}
                  <div className="space-y-0.5">
                    {filteredCustom.length === 0 && !isCreating ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No custom themes yet.
                        <br />
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1 h-auto p-0"
                          onClick={() => setIsCreating(true)}
                        >
                          Create your first theme
                        </Button>
                      </div>
                    ) : (
                      filteredCustom.map((theme) => (
                        <div
                          key={theme.id}
                          className={cn(
                            "group flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer",
                            selectedTheme?.type === "custom" && selectedTheme.theme.id === theme.id
                              ? "bg-accent"
                              : "hover:bg-accent/50"
                          )}
                          onClick={() => handleSelectCustom(theme)}
                        >
                          {theme.baseTheme === "dark" ? (
                            <Moon className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Sun className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="flex-1 text-sm truncate">{theme.name}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateTheme(theme);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportTheme(theme);
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTheme(theme);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Import button */}
            <div className="p-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleImportTheme}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Theme
              </Button>
            </div>
          </div>

          {/* Right Panel - Editor/Preview */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {selectedTheme ? (
              selectedTheme.type === "builtin" ? (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <div className="space-y-2">
                    <div className="text-muted-foreground">
                      Built-in themes cannot be edited.
                    </div>
                    <Button onClick={() => setIsCreating(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Custom Theme
                    </Button>
                  </div>
                </div>
              ) : editedTheme ? (
                <div className="flex-1 flex overflow-hidden min-h-0">
                  {/* Editor */}
                  <div className="w-[320px] border-r border-border flex flex-col min-h-0 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
                      <span className="text-sm font-medium">Edit Theme</span>
                      {hasUnsavedChanges && (
                        <span className="text-xs text-muted-foreground">(unsaved)</span>
                      )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <ThemeEditor
                        theme={editedTheme}
                        onChange={setEditedTheme}
                      />
                    </div>
                    <div className="p-2 border-t border-border shrink-0 bg-background">
                      <Button
                        className="w-full"
                        onClick={handleSaveTheme}
                        disabled={!hasUnsavedChanges}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex-1 p-4 bg-muted/30 overflow-auto">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Preview</div>
                      <ThemePreview theme={editedTheme} />
                    </div>
                  </div>
                </div>
              ) : null
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a theme to preview or edit
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
