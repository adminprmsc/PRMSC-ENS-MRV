import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  PageHeader,
  PageShell,
  PasswordField,
} from "../../components/layout";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { changePassword } from "../../services";
import { getApiErrorMessage } from "../../lib/api-error";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      toast.success(res.message || "Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      navigate(-1);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell narrow>
      <PageHeader
        icon={<KeyRound />}
        title="Change password"
        description="Update your account password. Your current password is required to confirm this change."
      />

      <Card>
        <CardHeader>
          <CardTitle>Security settings</CardTitle>
          <CardDescription>
            Use a strong password with at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <PasswordField
              id="current_password"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              required
            />

            <PasswordField
              id="new_password"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              required
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Updating…
                  </span>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
