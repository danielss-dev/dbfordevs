/**
 * ProviderModelSwitcher
 *
 * Compact dropdown for quick AI provider/model switching in the AI panel header.
 */

import { useEffect } from "react";
import { ChevronDown, Sparkles, Cpu, Check, Brain } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
} from "@/components/ui";
import { useAIStore } from "@/extensions/ai/store";
import { PROVIDER_INFO, type AIProviderType } from "@/extensions/ai/types";
import { cn } from "@/lib/utils";

const PROVIDER_ICONS: Record<AIProviderType, React.ReactNode> = {
  anthropic: <Sparkles className="h-3.5 w-3.5" />,
  gemini: <Cpu className="h-3.5 w-3.5" />,
  openai: <Brain className="h-3.5 w-3.5" />,
};

export function ProviderModelSwitcher() {
  const {
    settings,
    availableModels,
    fetchModels,
    setProvider,
    setModel,
    getCurrentProvider,
    getCurrentModel,
    isConfigured,
  } = useAIStore();

  // Fetch models on mount
  useEffect(() => {
    if (!availableModels) {
      fetchModels();
    }
  }, [availableModels, fetchModels]);

  const currentProvider = getCurrentProvider();
  const currentModel = getCurrentModel();

  // Get current model display name
  const currentModelName =
    availableModels?.[currentProvider]?.find((m) => m.id === currentModel)?.name ||
    currentModel;

  const handleModelChange = async (provider: AIProviderType, modelId: string) => {
    if (provider !== currentProvider) {
      await setProvider(provider);
    }
    await setModel(provider, modelId);
  };

  const configured = isConfigured();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs font-normal",
            !configured && "text-muted-foreground"
          )}
        >
          {PROVIDER_ICONS[currentProvider]}
          <span className="max-w-[120px] truncate">{currentModelName}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {(Object.keys(PROVIDER_INFO) as AIProviderType[]).map((provider) => {
          const models = availableModels?.[provider] || [];
          const providerConfigured =
            provider === "anthropic"
              ? !!(settings.aiAnthropicApiKey || settings.aiApiKey)
              : provider === "gemini"
              ? !!settings.aiGeminiApiKey
              : !!settings.aiOpenaiApiKey;

          return (
            <DropdownMenuGroup key={provider}>
              <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                {PROVIDER_ICONS[provider]}
                {PROVIDER_INFO[provider].displayName}
                {!providerConfigured && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Not configured
                  </span>
                )}
              </DropdownMenuLabel>
              {models.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => handleModelChange(provider, model.id)}
                  disabled={!providerConfigured}
                  className="pl-6"
                >
                  <span className="flex-1">{model.name}</span>
                  {currentProvider === provider && currentModel === model.id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              {provider !== "openai" && <DropdownMenuSeparator />}
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
