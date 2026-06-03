"use client";

import { cn } from "@mizan/shared-lib/utils";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Props {
  status: string;
  affectedRows?: number;
  className?: string;
}

export function NodeStatusIndicator({ status, affectedRows, className }: Props) {
  if (status === "PENDING" || !status) return null;

  const configs: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
    RUNNING: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: "执行中...",
      className: "text-blue-500 bg-blue-50",
    },
    COMPLETED: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      text: affectedRows !== undefined ? `${affectedRows} 行` : "完成",
      className: "text-green-600 bg-green-50",
    },
    FAILED: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      text: "失败",
      className: "text-red-600 bg-red-50",
    },
  };

  const cfg = configs[status] || {
    icon: <Clock className="h-3.5 w-3.5" />,
    text: status,
    className: "text-gray-500 bg-gray-50",
  };

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 text-xs rounded-b-lg", cfg.className, className)}>
      {cfg.icon}
      <span>{cfg.text}</span>
    </div>
  );
}
