import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import govtPunjabLogo from "../../assets/govt-punjab-logo.png";
import {
  AuthLayout,
  AuthMobileBrand,
  PasswordField,
} from "../../components/layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { resetPassword } from "../../services";
import { getApiErrorMessage } from "../../lib/api-error";

function useQueryParam(name: string): string | null {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const v = params.get(name);
    return v && v.trim() ? v : null;
  }, [location.search, name]);
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const tokenFromUrl = useQueryParam("token");

  const [token, setToken] = useState(tokenFromUrl ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await resetPassword(token, newPassword);
      toast.success(res.message || "Password reset successfully");
      navigate("/login", {
        replace: true,
        state: { message: "Password reset successfully. Please sign in." },
      });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to reset password"));
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
          Reset password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password using the token from your reset email.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <img
          src={govtPunjabLogo}
          alt="Government of Punjab emblem"
          className="h-7 w-7 object-contain"
        />
        <p className="text-xs font-medium text-muted-foreground">
          Government of Punjab affiliated initiative
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="token">Reset token</Label>
          <Input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token from email"
            required
            className="h-10 font-mono"
          />
        </div>

        <PasswordField
          id="new_password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          required
        />

        <Button type="submit" disabled={loading} className="h-10 w-full">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Resetting…
            </span>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Reset password
            </>
          )}
        </Button>
      </form>

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
