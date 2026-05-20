import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import companyLogo from "../../assets/company-logo.png";
import govtPunjabLogo from "../../assets/govt-punjab-logo.png";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { Link } from "react-router-dom";
import { defaultPathForRole } from "../../constants/roles";
import { useAuth } from "../../contexts/AuthContext";
import { getApiErrorMessage } from "../../lib/api-error";

type LoginLocationState = { message?: string };

const getErrorMessage = (error: unknown, fallback = "Login failed") =>
  getApiErrorMessage(error, fallback);

const getRedirectPathFromStorage = () => {
  const savedUserRaw = localStorage.getItem("mrv_user");
  if (!savedUserRaw) return "/submissions";
  try {
    const savedUser = JSON.parse(savedUserRaw) as { role?: string };
    return defaultPathForRole(savedUser?.role);
  } catch {
    return "/submissions";
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-100 to-slate-200 px-4 py-10">
      <Card className="w-full max-w-5xl overflow-hidden rounded-3xl border-slate-200/80 shadow-2xl">
        <div className="grid md:grid-cols-[1.05fr_0.95fr]">
          <CardContent className="flex flex-col justify-center space-y-6 p-8 md:p-10">
            <div className="flex items-center gap-3 md:hidden">
              <img
                src={companyLogo}
                alt="Punjab Rural Municipal Services Company logo"
                className="h-11 w-11 object-contain"
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Punjab Rural Municipal Services Company
                </p>
                <h1 className="text-lg font-bold text-slate-900">MRV System</h1>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                Secure Portal
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to continue to MRV System.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@prmsc.org.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11 rounded-xl border-slate-200 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-slate-200 pl-9"
                  />
                </div>
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline underline-offset-4"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {errorMessage ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl shadow-sm"
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

            <Separator className="bg-slate-200" />

            <p className="text-center text-xs text-muted-foreground">
              Authorized access only
            </p>
          </CardContent>

          <div className="hidden border-l border-slate-200 bg-slate-50 p-9 md:flex md:items-center md:justify-center">
            <div className="flex max-w-sm flex-col items-center justify-center gap-5 text-center">
              <div className="flex items-center justify-center gap-5">
                <img
                  src={companyLogo}
                  alt="Punjab Rural Municipal Services Company logo"
                  className="h-36 w-36 object-contain"
                />
                <img
                  src={govtPunjabLogo}
                  alt="Government of Punjab emblem"
                  className="h-24 w-24 object-contain"
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  MRV System
                </h2>
                <p className="text-sm font-semibold leading-tight text-slate-700">
                  Punjab Rural Municipal Services Company
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Government of Punjab Affiliated
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
