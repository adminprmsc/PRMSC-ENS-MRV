import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout, AuthMobileBrand } from "../../components/layout";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { forgotPassword } from "../../services";
import { getApiErrorMessage } from "../../lib/api-error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);
    setDevToken(null);
    try {
      const res = await forgotPassword(email);
      setMessage(res.message);
      if (res.reset_token) setDevToken(res.reset_token);
      toast.success("If the account exists, reset instructions will be sent.");
    } catch (err: unknown) {
      const m = getApiErrorMessage(err, "Failed to request password reset");
      toast.error(m);
      setMessage(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthMobileBrand />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Account recovery
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Forgot password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your work email and we&apos;ll send reset instructions if the
          account exists.
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <InputGroup className="h-10">
            <InputGroupAddon align="inline-start">
              <Mail className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              placeholder="name@prmsc.org.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </InputGroup>
        </div>

        <Button type="submit" disabled={loading} className="h-10 w-full">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </span>
          ) : (
            "Send reset instructions"
          )}
        </Button>
      </form>

      {message ? (
        <Alert variant={devToken ? "info" : "default"}>
          <AlertDescription>
            {message}
            {devToken ? (
              <div className="mt-3 rounded-lg border bg-background p-3 text-left">
                <p className="text-xs font-semibold text-foreground">
                  Dev reset token
                </p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {devToken}
                </p>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Separator />

      <p className="text-center text-sm text-muted-foreground">
        <Link
          to="/login"
          className="font-medium text-primary hover:underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
