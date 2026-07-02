import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import {
  AuthLayout,
} from "../../components/layout";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
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
        toast.error(message);
        return;
      }
      setErrorMessage("");
      navigate(getRedirectPathFromStorage(), { replace: true });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Login failed");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Secure Portal
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to the MRV monitoring portal.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary hover:underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
          <InputGroup className="h-10">
            <InputGroupAddon align="inline-start">
              <Lock className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </InputGroup>
        </div>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={loading} className="h-10 w-full">
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

      <Separator />

      <p className="text-center text-xs text-muted-foreground">
        Authorized personnel only · Punjab Rural Municipal Services Company
      </p>
    </AuthLayout>
  );
};

export default Login;
