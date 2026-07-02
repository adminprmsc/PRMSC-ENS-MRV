import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout, PasswordFieldWithIcon } from "../../components/layout";
import { Button } from "../../components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group";
import { Label } from "../../components/ui/label";
import { defaultPathForRole } from "../../constants/roles";
import { useAuth } from "../../contexts/AuthContext";
import { getApiErrorMessage } from "../../lib/api-error";

type LoginLocationState = { message?: string };

const getErrorMessage = (error: unknown, fallback = "Login failed") =>
  getApiErrorMessage(error, fallback);

const getRedirectPathFromStorage = () => {
  const savedUserRaw = localStorage.getItem("mrv_user");
  if (!savedUserRaw) return "/login";
  try {
    const savedUser = JSON.parse(savedUserRaw) as { role?: string };
    return defaultPathForRole(savedUser?.role);
  } catch {
    return "/login";
  }
};

const fieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

const inputGroupClass =
  "h-11 rounded-lg border-border/70 bg-background shadow-sm transition-shadow focus-within:shadow-md";

function LoginErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/15 bg-destructive/[0.04] px-3.5 py-3"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold leading-snug text-foreground">
          Could not sign in
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as LoginLocationState | null)?.message;

  useEffect(() => {
    const stored = sessionStorage.getItem("mrv_login_message");
    if (stored) {
      setErrorMessage(stored);
      sessionStorage.removeItem("mrv_login_message");
    }
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    toast.success(successMessage);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, successMessage]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        const message = result.message || "Invalid email or password";
        setErrorMessage(message);
        return;
      }
      setErrorMessage("");
      navigate(getRedirectPathFromStorage(), { replace: true });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Login failed");
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <header className="space-y-2 pb-1">
        <p className={fieldLabelClass}>Secure portal</p>
        <h1 className="font-heading text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sign in to continue to the MRV monitoring portal.
        </p>
      </header>

      <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email" className={fieldLabelClass}>
            Email address
          </Label>
          <InputGroup className={inputGroupClass}>
            <InputGroupAddon align="inline-start">
              <Mail className="size-4 text-muted-foreground/80" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              placeholder="name@prmsc.gov.pk"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              required
              autoComplete="email"
              className="text-[15px] placeholder:text-muted-foreground/50"
            />
          </InputGroup>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password" className={fieldLabelClass}>
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary/90 underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordFieldWithIcon
            id="password"
            label="Password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              if (errorMessage) setErrorMessage("");
            }}
            icon={<Lock className="size-4 text-muted-foreground/80" />}
            autoComplete="current-password"
            required
            className="space-y-2 [&_label]:sr-only"
            inputClassName={inputGroupClass}
          />
        </div>

        {errorMessage ? <LoginErrorAlert message={errorMessage} /> : null}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-lg text-[15px] font-semibold shadow-sm"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/80">
        Authorized personnel only · Punjab Rural Municipal Services Company
      </p>
    </AuthLayout>
  );
};

export default Login;
