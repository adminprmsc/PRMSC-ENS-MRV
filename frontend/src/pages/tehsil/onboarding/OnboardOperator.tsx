import { useEffect, useState } from "react";
import { PageHeader, PageShell, PasswordField } from "../../../components/layout";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { getApiErrorMessage } from "../../../lib/api-error";
import { useTehsilManagerOperatorApi, useUsersApi } from "../../../hooks";
import type { WaterSystemRow } from "../../../types/api";

export default function OnboardOperator() {
  const navigate = useNavigate();
  const { onboardOperator, onboardLoading } = useUsersApi();
  const { getWaterSystems } = useTehsilManagerOperatorApi();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Root123!");
  const [systems, setSystems] = useState<WaterSystemRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingSystems, setLoadingSystems] = useState(true);
  const selectedCount = selected.size;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getWaterSystems({});
        if (!cancelled) setSystems(Array.isArray(data) ? (data as WaterSystemRow[]) : []);
      } catch (e: unknown) {
        toast.error(getApiErrorMessage(e, "Could not load water systems"));
      } finally {
        if (!cancelled) setLoadingSystems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getWaterSystems]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(systems.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Name, email, and password are required.");
      return;
    }
    if (selected.size < 1) {
      toast.error("Select at least one water system to assign.");
      return;
    }
    try {
      await onboardOperator({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        water_system_ids: [...selected],
      });
      toast.success("Tubewell operator created.");
      setName("");
      setEmail("");
      setPassword("Root123!");
      setSelected(new Set());
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Onboarding failed"));
    }
  };

  return (
    <PageShell narrow>
      <PageHeader
        icon={<UserPlus />}
        title="Onboard operator"
        description="Create account and assign water systems"
        actions={
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
        }
      />

        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base">Operator details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="e.g. Ali Raza"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="operator@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <PasswordField
                  id="password"
                  label="Temporary password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  placeholder="Root123!"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label>
                    Water systems
                    {systems.length > 0 ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {selectedCount} / {systems.length}
                      </span>
                    ) : null}
                  </Label>
                  {!loadingSystems && systems.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                        Select all
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSelection}
                        disabled={selectedCount === 0}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : null}
                </div>

                {loadingSystems ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading systems…
                  </p>
                ) : systems.length === 0 ? (
                  <Alert variant="info">
                    <AlertDescription>
                      No water systems in scope.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-72 rounded-lg border bg-card p-3">
                    <ul className="space-y-2">
                      {systems.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5 hover:bg-muted/40"
                        >
                          <Checkbox
                            id={`ws-${s.id}`}
                            checked={selected.has(s.id)}
                            onCheckedChange={() => toggle(s.id)}
                          />
                          <label
                            htmlFor={`ws-${s.id}`}
                            className="cursor-pointer text-sm leading-snug"
                          >
                            <span className="font-medium text-slate-900">
                              {s.tehsil} — {s.village}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {s.settlement ? `${s.settlement} · ` : ""}
                              {s.unique_identifier}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={onboardLoading || loadingSystems}
                >
                  {onboardLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create operator"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </PageShell>
  );
}
