import * as React from "react";
import { Binary, Image, Copy, DownloadSimple, FileText, Code } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGridStore } from "@/stores/grid";
import {
  tryParseBinary,
  generateHexView,
  bytesToBase64,
  detectImageType,
  createImageDataUrl,
  formatByteSize,
} from "@/lib/binary-utils";
import { copyToClipboard } from "@/lib/utils";
import { showSuccessToast } from "@/lib/toast-helpers";
import type { BinaryPreviewMode, DetectedImageInfo } from "@/types/grid";

export function BinaryPreviewDialog() {
  const {
    binaryPreviewValue,
    binaryPreviewDialogOpen,
    closeBinaryPreviewDialog,
    binaryPreview: config,
  } = useGridStore();

  const [activeTab, setActiveTab] = React.useState<BinaryPreviewMode>("hex");
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null);
  const [imageInfo, setImageInfo] = React.useState<DetectedImageInfo | null>(null);
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null);

  // Parse binary data when dialog opens
  React.useEffect(() => {
    if (!binaryPreviewDialogOpen || !binaryPreviewValue) {
      setBytes(null);
      setImageInfo(null);
      setImageDataUrl(null);
      return;
    }

    const parsed = tryParseBinary(binaryPreviewValue);
    setBytes(parsed);

    if (parsed && config.autoDetectImages) {
      const detected = detectImageType(parsed);
      setImageInfo(detected);

      if (detected) {
        const dataUrl = createImageDataUrl(parsed, detected.mimeType);
        setImageDataUrl(dataUrl);
        setActiveTab("image");
      } else {
        setActiveTab(config.defaultMode);
      }
    } else {
      setActiveTab(config.defaultMode);
    }
  }, [binaryPreviewDialogOpen, binaryPreviewValue, config]);

  const handleCopyHex = async () => {
    if (!bytes) return;
    const hex = generateHexView(bytes, config.hexBytesPerRow);
    await copyToClipboard(hex);
    showSuccessToast("Copied", "Hex view copied to clipboard");
  };

  const handleCopyBase64 = async () => {
    if (!bytes) return;
    const base64 = bytesToBase64(bytes);
    await copyToClipboard(base64);
    showSuccessToast("Copied", "Base64 copied to clipboard");
  };

  const handleDownload = () => {
    if (!bytes) return;

    const blob = new Blob([bytes], {
      type: imageInfo?.mimeType || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = imageInfo
      ? `image.${imageInfo.type}`
      : "binary_data.bin";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!binaryPreviewValue) return null;

  const hexView = bytes ? generateHexView(bytes, config.hexBytesPerRow) : "";
  const base64 = bytes ? bytesToBase64(bytes) : "";
  const byteSize = bytes ? formatByteSize(bytes.length) : "0 B";

  return (
    <Dialog open={binaryPreviewDialogOpen} onOpenChange={closeBinaryPreviewDialog}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Binary weight="regular" className="h-5 w-5" />
            Binary Data Preview
            <span className="text-sm font-normal text-muted-foreground">
              ({byteSize})
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BinaryPreviewMode)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="hex" className="gap-1.5">
                <Code weight="regular" className="h-3.5 w-3.5" />
                Hex
              </TabsTrigger>
              <TabsTrigger value="base64" className="gap-1.5">
                <FileText weight="regular" className="h-3.5 w-3.5" />
                Base64
              </TabsTrigger>
              {imageInfo && (
                <TabsTrigger value="image" className="gap-1.5">
                  <Image weight="regular" className="h-3.5 w-3.5" />
                  Image
                </TabsTrigger>
              )}
              <TabsTrigger value="text" className="gap-1.5">
                <FileText weight="regular" className="h-3.5 w-3.5" />
                Text
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5"
                onClick={activeTab === "base64" ? handleCopyBase64 : handleCopyHex}
              >
                <Copy weight="regular" className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5"
                onClick={handleDownload}
              >
                <DownloadSimple weight="regular" className="h-3.5 w-3.5" />
                DownloadSimple
              </Button>
            </div>
          </div>

          <TabsContent value="hex" className="mt-2">
            <ScrollArea className="h-[400px] w-full rounded border bg-muted/30">
              <pre className="p-3 text-xs font-mono whitespace-pre leading-relaxed">
                {hexView || "Unable to parse binary data"}
              </pre>
            </ScrollArea>
            <div className="mt-2 text-xs text-muted-foreground">
              Format: Offset | Hex ({config.hexBytesPerRow} bytes per row) | ASCII
            </div>
          </TabsContent>

          <TabsContent value="base64" className="mt-2">
            <ScrollArea className="h-[400px] w-full rounded border bg-muted/30">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {base64 || "Unable to convert to Base64"}
              </pre>
            </ScrollArea>
            <div className="mt-2 text-xs text-muted-foreground">
              Base64 encoded data ({base64.length} characters)
            </div>
          </TabsContent>

          {imageInfo && imageDataUrl && (
            <TabsContent value="image" className="mt-2">
              <div className="flex flex-col items-center gap-4">
                <div className="border rounded-lg p-4 bg-muted/30 max-h-[360px] overflow-auto">
                  <img
                    src={imageDataUrl}
                    alt="Binary data preview"
                    className="max-w-full h-auto"
                    style={{ maxHeight: 320 }}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {imageInfo.type.toUpperCase()}
                  {imageInfo.width && imageInfo.height && (
                    <span> - {imageInfo.width} x {imageInfo.height} px</span>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="text" className="mt-2">
            <ScrollArea className="h-[400px] w-full rounded border bg-muted/30">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {bytes
                  ? new TextDecoder("utf-8", { fatal: false }).decode(bytes)
                  : "Unable to decode as text"}
              </pre>
            </ScrollArea>
            <div className="mt-2 text-xs text-muted-foreground">
              Decoded as UTF-8 text (non-printable characters may appear as replacement characters)
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
