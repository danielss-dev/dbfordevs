import { useState, useEffect } from "react";
import { Eye, EyeOff, ExternalLink, Settings2, Sparkles, Cpu, Brain } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useAIStore } from "@/extensions/ai/store";
import { PROVIDER_INFO, DEFAULT_MODELS, type AIProviderType } from "@/extensions/ai/types";
import { open as openUrl } from "@tauri-apps/plugin-shell";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDER_ICONS: Record<AIProviderType, React.ReactNode> = {
  anthropic: <Sparkles className="h-4 w-4" />,
  gemini: <Cpu className="h-4 w-4" />,
  openai: <Brain className="h-4 w-4" />,
};

export function AISettingsDialog({
  open,
  onOpenChange,
}: AISettingsDialogProps) {
  const {
    settings,
    availableModels,
    fetchModels,
    updateSettings,
  } = useAIStore();

  const [localSettings, setLocalSettings] = useState({
    provider: settings.aiProvider || "anthropic",
    anthropicApiKey: settings.aiAnthropicApiKey || settings.aiApiKey || "",
    geminiApiKey: settings.aiGeminiApiKey || "",
    openaiApiKey: settings.aiOpenaiApiKey || "",
    anthropicModel: settings.aiAnthropicModel || DEFAULT_MODELS.anthropic,
    geminiModel: settings.aiGeminiModel || DEFAULT_MODELS.gemini,
    openaiModel: settings.aiOpenaiModel || DEFAULT_MODELS.openai,
    temperature: settings.aiTemperature ?? 0.1,
    maxTokens: settings.aiMaxTokens ?? 2048,
  });

  const [showKeys, setShowKeys] = useState<Record<AIProviderType, boolean>>({
    anthropic: false,
    gemini: false,
    openai: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Fetch models when dialog opens
  useEffect(() => {
    if (open && !availableModels) {
      fetchModels();
    }
  }, [open, availableModels, fetchModels]);

  // Load current settings when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSettings({
        provider: settings.aiProvider || "anthropic",
        anthropicApiKey: settings.aiAnthropicApiKey || settings.aiApiKey || "",
        geminiApiKey: settings.aiGeminiApiKey || "",
        openaiApiKey: settings.aiOpenaiApiKey || "",
        anthropicModel: settings.aiAnthropicModel || DEFAULT_MODELS.anthropic,
        geminiModel: settings.aiGeminiModel || DEFAULT_MODELS.gemini,
        openaiModel: settings.aiOpenaiModel || DEFAULT_MODELS.openai,
        temperature: settings.aiTemperature ?? 0.1,
        maxTokens: settings.aiMaxTokens ?? 2048,
      });
    }
  }, [open, settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        aiProvider: localSettings.provider as AIProviderType,
        aiAnthropicApiKey: localSettings.anthropicApiKey || undefined,
        aiGeminiApiKey: localSettings.geminiApiKey || undefined,
        aiOpenaiApiKey: localSettings.openaiApiKey || undefined,
        aiAnthropicModel: localSettings.anthropicModel,
        aiGeminiModel: localSettings.geminiModel,
        aiOpenaiModel: localSettings.openaiModel,
        aiTemperature: localSettings.temperature,
        aiMaxTokens: localSettings.maxTokens,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenConsole = async (provider: AIProviderType) => {
    try {
      await openUrl(PROVIDER_INFO[provider].apiKeyUrl);
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  const toggleShowKey = (provider: AIProviderType) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const getApiKeyField = (provider: AIProviderType): "anthropicApiKey" | "geminiApiKey" | "openaiApiKey" => {
    switch (provider) {
      case "anthropic":
        return "anthropicApiKey";
      case "gemini":
        return "geminiApiKey";
      case "openai":
        return "openaiApiKey";
    }
  };

  const getModelField = (provider: AIProviderType): "anthropicModel" | "geminiModel" | "openaiModel" => {
    switch (provider) {
      case "anthropic":
        return "anthropicModel";
      case "gemini":
        return "geminiModel";
      case "openai":
        return "openaiModel";
    }
  };

  const getPlaceholder = (provider: AIProviderType) => {
    switch (provider) {
      case "anthropic":
        return "sk-ant-api03-...";
      case "gemini":
        return "AIza...";
      case "openai":
        return "sk-...";
    }
  };

  // Ensure current provider is valid (handles legacy "openai" values from persisted state)
  const currentProvider: AIProviderType =
    localSettings.provider in PROVIDER_INFO
      ? (localSettings.provider as AIProviderType)
      : "anthropic";
  const models = availableModels?.[currentProvider] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Settings2 className="h-4 w-4" />
            </div>
            AI Assistant Settings
          </DialogTitle>
          <DialogDescription>
            Configure your AI provider, models, and generation parameters.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="provider" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="provider">Provider</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
          </TabsList>

          <TabsContent value="provider" className="space-y-4 py-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Provider</Label>
              <Select
                value={localSettings.provider}
                onValueChange={(value: AIProviderType) =>
                  setLocalSettings((prev) => ({ ...prev, provider: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_INFO) as AIProviderType[]).map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      <div className="flex items-center gap-2">
                        {PROVIDER_ICONS[provider]}
                        {PROVIDER_INFO[provider].displayName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key for current provider */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {PROVIDER_INFO[currentProvider].displayName} API Key
              </Label>
              <div className="relative">
                <Input
                  type={showKeys[currentProvider] ? "text" : "password"}
                  value={localSettings[getApiKeyField(currentProvider)]}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      [getApiKeyField(currentProvider)]: e.target.value,
                    }))
                  }
                  placeholder={getPlaceholder(currentProvider)}
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => toggleShowKey(currentProvider)}
                >
                  {showKeys[currentProvider] ? (
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

            {/* Get API Key link */}
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="text-sm font-medium mb-2">Get an API key</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Visit the {PROVIDER_INFO[currentProvider].displayName} console to create an API key.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleOpenConsole(currentProvider)}
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Open {PROVIDER_INFO[currentProvider].displayName} Console
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="model" className="space-y-4 py-4">
            {/* Model Selection for current provider */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {PROVIDER_INFO[currentProvider].displayName} Model
              </Label>
              <Select
                value={localSettings[getModelField(currentProvider)]}
                onValueChange={(value) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    [getModelField(currentProvider)]: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        {model.name}
                        {model.default && (
                          <span className="text-xs text-muted-foreground">(default)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the AI model to use for generating SQL queries.
              </p>
            </div>

            {/* Model descriptions */}
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <h4 className="text-sm font-medium mb-2">About Models</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {currentProvider === "anthropic" && (
                  <>
                    <li><strong>Opus 4.5:</strong> Most capable, best for complex queries</li>
                    <li><strong>Sonnet 4.5:</strong> Balanced performance and speed</li>
                    <li><strong>Haiku 4.5:</strong> Fastest, great for simple queries</li>
                  </>
                )}
                {currentProvider === "gemini" && (
                  <>
                    <li><strong>Gemini 3 Pro:</strong> Most capable for complex reasoning</li>
                    <li><strong>Gemini 3 Flash:</strong> Fast, optimized for speed</li>
                  </>
                )}
                {currentProvider === "openai" && (
                  <>
                    <li><strong>GPT-5.2:</strong> Most capable, great for complex queries</li>
                    <li><strong>GPT-5 Mini:</strong> Fast and cost-effective</li>
                    <li><strong>GPT-5.2 Pro:</strong> Advanced reasoning model</li>
                  </>
                )}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="parameters" className="space-y-4 py-4">
            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Temperature</Label>
                <span className="text-sm text-muted-foreground">
                  {localSettings.temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                value={localSettings.temperature}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                }
                min={0}
                max={2}
                step={0.1}
                className="w-full accent-violet-500"
              />
              <p className="text-xs text-muted-foreground">
                Lower values produce more focused, deterministic output. Higher values are more creative.
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Max Tokens</Label>
              <Input
                type="number"
                value={localSettings.maxTokens}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    maxTokens: parseInt(e.target.value) || 2048,
                  }))
                }
                min={100}
                max={8192}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of tokens in the AI response (100-8192).
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

