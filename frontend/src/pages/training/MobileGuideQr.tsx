import { useMemo } from "react";
import { QrCode, Smartphone } from "lucide-react";

import { trainingRoutes } from "@/constants/routes";

type MobileGuideQrProps = {
  className?: string;
};

/** QR encodes the public training guide URL for sharing with field operators. */
export function MobileGuideQr({ className }: MobileGuideQrProps) {
  const guideUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${trainingRoutes.guide("mobile-operator")}`;
  }, []);

  const qrSrc = guideUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(guideUrl)}`
    : "";

  if (!guideUrl) return null;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border/70 bg-muted/20 ${className ?? ""}`}
    >
      <div className="border-b border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Smartphone className="size-4 text-primary" />
          Share with mobile operators
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Scan or copy the link for field training on phone.
        </p>
      </div>
      <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <div className="rounded-lg border border-border/60 bg-background p-2 shadow-sm">
          <img
            src={qrSrc}
            alt="QR code to open the mobile operator training guide"
            width={160}
            height={160}
          />
        </div>
        <div className="min-w-0 text-sm text-muted-foreground">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-foreground">
            <QrCode className="size-3.5" />
            Operator guide URL
          </div>
          <a
            href={guideUrl}
            className="mt-2 inline-block break-all font-medium text-foreground underline-offset-4 hover:underline"
          >
            {guideUrl}
          </a>
        </div>
      </div>
    </div>
  );
}
