import { useState, type MouseEvent } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type CopyableIdProps = {
  value: string;
  /** Accessible name for the copy control */
  label?: string;
  className?: string;
};

export function CopyableId({
  value,
  label = "ID",
  className,
}: CopyableIdProps) {
  const [copied, setCopied] = useState(false);
  const text = value?.trim() || "";

  const onCopy = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  if (!text) return <span className="text-muted-foreground">—</span>;

  return (
    <span className={className ?? "inline-flex max-w-full items-center gap-1"}>
      <span className="truncate font-mono text-xs font-medium sm:text-sm">
        {text}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        title={`Copy ${label}`}
        aria-label={`Copy ${label}: ${text}`}
        onClick={(e) => void onCopy(e)}
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <ClipboardCopy className="size-3.5" />
        )}
      </Button>
    </span>
  );
}
