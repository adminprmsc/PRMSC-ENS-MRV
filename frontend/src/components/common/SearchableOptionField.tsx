import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type SearchableOptionFieldProps = {
  label: string;
  hint?: string;
  /** Hide built-in label when wrapped in an external FormField. */
  hideLabel?: boolean;
  value: string;
  options: string[];
  /** When set (including `""`), shows an “all / clear / none” row. Omit for required pickers. */
  allValue?: string;
  allLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  maxResults?: number;
  className?: string;
  onChange: (value: string) => void;
  optionLabel?: (value: string) => string;
};

/** Typeahead field that keeps focus while filtering; results render in a portal. */
export function SearchableOptionField({
  label,
  hint,
  hideLabel = false,
  value,
  options,
  allValue,
  allLabel,
  disabled,
  placeholder,
  maxResults = 80,
  className,
  onChange,
  optionLabel,
}: SearchableOptionFieldProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const emptyValue = allValue ?? "";
  const hasAllOption = allValue !== undefined;

  const choices = useMemo(() => {
    const rest = hasAllOption
      ? options.filter((o) => o !== allValue)
      : options;
    const q = query.trim().toLowerCase();
    const labelOf = (o: string) =>
      `${o} ${optionLabel ? optionLabel(o) : ""}`.toLowerCase();
    const matched = q
      ? rest
          .filter((o) => labelOf(o).includes(q))
          .sort((a, b) => {
            const aText = labelOf(a);
            const bText = labelOf(b);
            const aStarts =
              aText.startsWith(q) || a.toLowerCase().startsWith(q) ? 0 : 1;
            const bStarts =
              bText.startsWith(q) || b.toLowerCase().startsWith(q) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.localeCompare(b);
          })
      : rest;
    return {
      items: matched.slice(0, maxResults),
      matchCount: matched.length,
      truncated: matched.length > maxResults,
      total: rest.length,
    };
  }, [options, allValue, hasAllOption, query, maxResults, optionLabel]);

  const syncRect = () => {
    const el = anchorRef.current;
    if (!el) return;
    setRect(el.getBoundingClientRect());
  };

  useEffect(() => {
    setQuery("");
  }, [value, allValue]);

  useEffect(() => {
    if (!open) return;
    syncRect();
    const onReposition = () => syncRect();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const display = (v: string) => (optionLabel ? optionLabel(v) : v);
  const allText = allLabel ?? allValue ?? "All";
  const hasSelection = Boolean(value) && value !== emptyValue;

  const selectValue = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

  let menu: ReactNode = null;
  if (open && rect && typeof document !== "undefined") {
    menu = createPortal(
      <div
        ref={menuRef}
        data-searchable-option-menu=""
        style={{
          position: "fixed",
          top: rect.bottom + 6,
          left: rect.left,
          width: Math.max(rect.width, 220),
          zIndex: 200,
        }}
        className="max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      >
        {hasAllOption ? (
          <button
            type="button"
            className={cn(
              "flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted",
              value === allValue && "bg-muted font-medium",
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectValue(allValue as string)}
          >
            {allText}
          </button>
        ) : null}
        {choices.items.map((item) => (
          <button
            key={item}
            type="button"
            className={cn(
              "flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted",
              value === item && "bg-muted font-medium",
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectValue(item)}
          >
            {display(item)}
          </button>
        ))}
        {choices.items.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            No matches{query.trim() ? ` for “${query.trim()}”` : ""}
          </p>
        ) : null}
        {choices.truncated ? (
          <p className="border-t border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            Showing {maxResults} of {choices.matchCount} — keep typing to narrow.
          </p>
        ) : null}
      </div>,
      document.body,
    );
  }

  const control = (
    <div className={cn("space-y-1", className)}>
      <div ref={anchorRef}>
        <InputGroup
          className={cn(
            "h-8 w-full bg-background",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            value={open ? query : hasSelection ? display(value) : query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery("");
              setOpen(true);
              syncRect();
            }}
            onClick={() => {
              setOpen(true);
              syncRect();
            }}
            placeholder={
              hasSelection
                ? display(value)
                : (placeholder ?? label)
            }
            className="text-xs"
            autoComplete="off"
            aria-expanded={open}
            aria-autocomplete="list"
          />
          {hasSelection && !open ? (
            <InputGroupAddon align="inline-end">
              <button
                type="button"
                className="text-[10px] font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  selectValue(emptyValue);
                }}
                disabled={disabled}
              >
                Clear
              </button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>
      {menu}
    </div>
  );

  if (hideLabel) return control;

  return (
    <Field className="min-w-0 gap-1">
      <FieldLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </FieldLabel>
      {control}
    </Field>
  );
}
