import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";

// Resize an image File to a max width and re-encode as a JPEG data URL.
// Keeps DB rows small even when the user picks a 4000px phone photo.
async function fileToResizedDataUrl(
  file: File,
  maxWidth = 1200,
  quality = 0.82,
): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Couldn't read image"));
      im.src = url;
    });
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImageUpload({
  value,
  onChange,
  label = "Photo",
  buttonLabel = "Upload photo",
  helper,
  testId = "input-image-upload",
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  buttonLabel?: string;
  helper?: string;
  testId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Pick an image file (JPG, PNG, or HEIC).");
      }
      const dataUrl = await fileToResizedDataUrl(file);
      onChange(dataUrl);
    } catch (err: any) {
      setError(err?.message || "Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-2 flex flex-wrap items-start gap-4">
        {value ? (
          <div className="relative">
            <img
              src={value}
              alt="Preview"
              className="h-32 w-48 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
              aria-label="Remove photo"
              data-testid={`${testId}-remove`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="grid h-32 w-48 place-items-center rounded-lg border border-dashed border-border bg-card/40 text-xs text-muted-foreground">
            No photo yet
          </div>
        )}
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
            data-testid={`${testId}-file`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            data-testid={testId}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {value ? "Replace photo" : buttonLabel}
          </Button>
          {helper && (
            <p className="max-w-xs text-xs text-muted-foreground">{helper}</p>
          )}
          {error && (
            <p className="max-w-xs text-xs text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
