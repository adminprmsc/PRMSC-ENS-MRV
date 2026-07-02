import { Check } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type StepItem = {
  id: number;
  label: string;
  hint?: string;
};

type FormStepperProps = {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
  showProgress?: boolean;
};

export function FormStepper({
  steps,
  currentStep,
  onStepClick,
  className,
  showProgress = false,
}: FormStepperProps) {
  const progressValue =
    steps.length <= 1 ? 100 : ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        Step {currentStep} of {steps.length}
      </p>

      {showProgress ? <Progress value={progressValue} /> : null}

      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "rounded-lg border bg-card p-3 text-left transition-colors",
                isCurrent
                  ? "border-foreground/20 shadow-sm ring-1 ring-foreground/10"
                  : isDone
                    ? "border-border hover:bg-muted/40"
                    : "border-border/80 hover:bg-muted/30",
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border border-foreground/30 text-foreground"
                        : "border border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="size-3" /> : step.id}
                </span>
                <span className={isCurrent ? "text-foreground" : "text-muted-foreground"}>
                  {step.label}
                </span>
              </div>
              {step.hint ? (
                <p className="pl-7 text-xs leading-relaxed text-muted-foreground">
                  {step.hint}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

