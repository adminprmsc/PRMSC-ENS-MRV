import type { ReactNode } from "react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DataPanelProps = {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

/** WFM-style bordered data section used for tables, filters, and lists. */
export function DataPanel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: DataPanelProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base font-semibold tracking-tight">
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("pt-4", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
