import { Bell, BellRing, MessageSquareText, Settings, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationPrefs } from "@/lib/notificationPrefs";
import { playChimeFromGesture } from "@/lib/notificationSound";

function SettingRow({
  id,
  icon,
  title,
  description,
  checked,
  onChange,
  action,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {title}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        aria-label={title}
        className="mt-1"
      />
    </div>
  );
}

/** Personal settings — notification sound & pop-ups (this device). */
export default function SettingsPage() {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : undefined;
  const { prefs, update } = useNotificationPrefs(userId);

  const testSound = async () => {
    if (!(await playChimeFromGesture())) {
      toast.info("Sound isn’t available in this browser", {
        description: "Check that the tab isn’t muted and your device volume is on.",
      });
    }
  };

  return (
    <PageShell narrow>
      <PageHeader
        icon={<Settings />}
        title="Settings"
        description="Personal preferences for this device."
      />

      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4 text-muted-foreground" />
            Notifications
          </CardTitle>
          <CardDescription>
            How you are alerted when something new arrives — approvals, rejections,
            change history and feature updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y pt-4">
          <SettingRow
            id="pref-sound"
            icon={<Volume2 className="size-4" />}
            title="Play a sound"
            description="A short chime when a new notification arrives."
            checked={prefs.sound}
            onChange={(v) => {
              update({ sound: v });
              if (v) void playChimeFromGesture();
            }}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void testSound()}
                disabled={!prefs.sound}
              >
                Test sound
              </Button>
            }
          />
          <SettingRow
            id="pref-popups"
            icon={<MessageSquareText className="size-4" />}
            title="Show pop-up alerts"
            description="A message in the corner of the screen with a View button."
            checked={prefs.popups}
            onChange={(v) => update({ popups: v })}
          />
          <div className="flex items-start gap-3 pt-4 text-xs text-muted-foreground">
            <Bell className="mt-0.5 size-4 shrink-0" />
            <p>
              The bell badge and the “What’s new” banner always show, even when
              sound and pop-ups are off, so nothing is missed. These settings
              apply to this browser only.
            </p>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
