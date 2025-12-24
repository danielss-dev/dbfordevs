import { useState, useEffect } from "react";
import { Eye, EyeOff, Key, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
} from "@/components/ui";
import { useExtensionSettings } from "@/extensions";
import { open as openUrl } from "@tauri-apps/plugin-shell";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({
  open,
  onOpenChange,
}: AISettingsDialogProps) {
  const { settings, updateSettings } = useExtensionSettings();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load current key when dialog opens
  useEffect(() => {
    if (open && settings.aiApiKey) {
      setApiKey(settings.aiApiKey);
    }
  }, [open, settings.aiApiKey]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ aiApiKey: apiKey });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAnthropicConsole = async () => {
    try {
      await openUrl("https://console.anthropic.com/settings/keys");
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Key className="h-4 w-4" />
            </div>
            AI Assistant Settings
          </DialogTitle>
          <DialogDescription>
            Configure your API key to enable the AI Assistant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-sm font-medium">
              Anthropic API Key
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="pr-10 font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your API key is stored locally and never sent to our servers.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <h4 className="text-sm font-medium mb-2">How to get an API key</h4>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Visit the Anthropic Console</li>
              <li>Sign in or create an account</li>
              <li>Navigate to API Keys</li>
              <li>Create a new key and copy it here</li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs"
              onClick={handleOpenAnthropicConsole}
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Open Anthropic Console
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!apiKey.trim() || isSaving}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

