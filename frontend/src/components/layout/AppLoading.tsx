import { Spinner } from "@/components/ui/spinner";

type AppLoadingProps = {
  label?: string;
};

export function AppLoading({ label = "Loading portal…" }: AppLoadingProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Spinner className="size-8 text-primary" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
