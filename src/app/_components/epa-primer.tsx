"use client";

import { useState } from "react";
import {
  Activity,
  Building2,
  ChevronDown,
  Globe,
  Lightbulb,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const GUIDE_CARDS = [
  {
    icon: Building2,
    tone: "text-emerald-400",
    title: "ORISPL Plant Identifier",
    body: "Permanent federal facility ID issued by the DOE/EIA, uniquely indexing every commercial generation facility across all 50 states.",
  },
  {
    icon: Globe,
    tone: "text-sky-400",
    title: "NERC Regional Grids",
    body: "Independent reliability councils (such as ERCOT, WECC, SERC, RFC) managing synchronized transmission grids and reserve margins.",
  },
  {
    icon: Zap,
    tone: "text-amber-400",
    title: "Nameplate Capacity (MW)",
    body: "Maximum sustained electrical output rating. Roughly 1 Megawatt (MW) reliably powers approximately 750 to 1,000 homes.",
  },
  {
    icon: Activity,
    tone: "text-emerald-400",
    title: "Carbon Intensity Rate",
    body: "Pounds of direct CO₂ emitted per MWh generated (lbs/MWh). Gas CCGT ~800, Coal ~2,100, Renewables/Nuclear = 0.",
  },
  {
    icon: ShieldCheck,
    tone: "text-rose-400",
    title: "Automated Thermodynamic Auditing",
    body: "Continuous rule validation detecting thermodynamic discrepancies such as out-of-bounds heat rates, phantom power generation, or zero-emissions combustion flags.",
    wide: true,
  },
];

export function EpaPrimer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-edge/80 bg-surface/30 rounded-lg border">
      <div className="flex items-center justify-between gap-3 p-3 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="border-edge/50 bg-surface-2/50 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
            <Lightbulb className="h-3.5 w-3.5 text-amber-400/90" />
          </div>
          <div className="min-w-0">
            <span className="text-fg block truncate text-base font-medium">
              Power Grid & Emissions Reference Guide
            </span>
            <p className="text-fg-muted hidden truncate text-xs sm:block">
              Key concepts: ORISPL plant IDs, NERC grids, capacity metrics, and
              sanity audits
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className="shrink-0"
        >
          {isOpen ? "Hide Guide" : "Reference Guide"}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </Button>
      </div>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 border-edge/80 grid grid-cols-1 gap-3 border-t p-3 duration-150 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          {GUIDE_CARDS.map(({ icon: Icon, tone, title, body, wide }) => (
            <div
              key={title}
              className={cn(
                "border-edge/80 bg-canvas/60 space-y-2 rounded-lg border p-3.5",
                wide && "sm:col-span-2",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  tone,
                )}
              >
                <Icon className="h-4 w-4" />
                {title}
              </div>
              <p className="text-fg-2 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
