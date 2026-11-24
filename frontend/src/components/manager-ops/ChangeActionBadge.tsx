import { Badge } from "@/components/ui/badge";

export function ChangeActionBadge({ action }: { action: string }) {
  const isDelete = action === "delete";
  return (
    <Badge
      variant="outline"
      className={
        isDelete
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }
    >
      {isDelete ? "Deleted" : "Rejected"}
    </Badge>
  );
}
