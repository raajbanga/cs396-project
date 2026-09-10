import * as React from "react";
import { Activity, Clock, Factory, Power, Zap } from "lucide-react";
import { type PlantRoleInfo } from "~/lib/plant-narrative";
import { cn } from "~/lib/utils";

export interface PlantRoleBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  roleInfo: PlantRoleInfo;
}

export function PlantRoleBadge({
  roleInfo,
  className,
  ...props
}: PlantRoleBadgeProps) {
  const renderIcon = () => {
    switch (roleInfo.icon) {
      case "zap":
        return <Zap className="h-2.5 w-2.5 shrink-0" />;
      case "clock":
        return <Clock className="h-2.5 w-2.5 shrink-0" />;
      case "factory":
        return <Factory className="h-2.5 w-2.5 shrink-0" />;
      case "power":
        return <Power className="h-2.5 w-2.5 shrink-0" />;
      default:
        return <Activity className="h-2.5 w-2.5 shrink-0" />;
    }
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap select-none",
        roleInfo.badgeClass,
        className,
      )}
      title={roleInfo.description}
      {...props}
    >
      {renderIcon()}
      <span className="whitespace-nowrap">{roleInfo.badgeLabel}</span>
    </span>
  );
}
