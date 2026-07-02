import { Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GuideBlock } from "@/content/training/guides";

type TrainingGuideBodyProps = {
  blocks: GuideBlock[];
};

export function TrainingGuideBody({ blocks }: TrainingGuideBodyProps) {
  return (
    <article className="max-w-none space-y-5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <h2
                key={index}
                className="border-b border-border/60 pb-2 pt-4 text-base font-semibold tracking-tight text-foreground first:pt-0"
              >
                {block.text}
              </h2>
            );
          case "paragraph":
            return (
              <p
                key={index}
                className="text-sm leading-7 text-muted-foreground"
              >
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul
                key={index}
                className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-foreground"
              >
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={index} className="space-y-3">
                {block.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 shadow-sm"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-sm leading-relaxed text-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "tip":
            return (
              <div
                key={index}
                className={cn(
                  "flex gap-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950",
                )}
              >
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="font-semibold">Tip: </strong>
                  {block.text}
                </p>
              </div>
            );
          default:
            return null;
        }
      })}
    </article>
  );
}
