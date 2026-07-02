import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

type AuthFormFooterProps = {
  backToLogin?: boolean;
};

export function AuthFormFooter({ backToLogin = false }: AuthFormFooterProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Authorized PRMSC personnel only. Sign-in activity may be logged for
          compliance and audit purposes.
        </p>
      </div>

      {backToLogin ? (
        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
