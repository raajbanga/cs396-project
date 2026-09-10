"use client";

import { useState } from "react";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronUp,
  Globe,
  Lightbulb,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "~/components/ui/button";

export function EpaPrimer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-edge/80 bg-surface/30 rounded-lg border transition-all">
      {/* Banner Header */}
      <div className="flex items-center justify-between gap-3 p-3 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="border-edge/50 bg-surface-2/50 text-fg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
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
          className="text-fg-muted hover:text-fg h-8 shrink-0 gap-1.5 px-3 text-xs"
        >
          <span>{isOpen ? "Hide Guide" : "Reference Guide"}</span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Expanded Guide Cards */}
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 border-edge/80 border-t p-3 duration-150 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border-edge/80 bg-canvas/60 space-y-2 rounded-lg border p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <Building2 className="h-4 w-4" />
                <span>ORISPL Plant Identifier</span>
              </div>
              <p className="text-fg-2 text-sm leading-relaxed">
                Permanent federal facility ID issued by the DOE/EIA, uniquely
                indexing every commercial generation facility across all 50
                states.
              </p>
            </div>

            <div className="border-edge/80 bg-canvas/60 space-y-2 rounded-lg border p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
                <Globe className="h-4 w-4" />
                <span>NERC Regional Grids</span>
              </div>
              <p className="text-fg-2 text-sm leading-relaxed">
                Independent reliability councils (such as ERCOT, WECC, SERC,
                RFC) managing synchronized transmission grids and reserve
                margins.
              </p>
            </div>

            <div className="border-edge/80 bg-canvas/60 space-y-2 rounded-lg border p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                <Zap className="h-4 w-4" />
                <span>Nameplate Capacity (MW)</span>
              </div>
              <p className="text-fg-2 text-sm leading-relaxed">
                Maximum sustained electrical output rating. Roughly 1 Megawatt
                (MW) reliably powers approximately 750 to 1,000 homes.
              </p>
            </div>

            <div className="border-edge/80 bg-canvas/60 space-y-2 rounded-lg border p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <Activity className="h-4 w-4" />
                <span>Carbon Intensity Rate</span>
              </div>
              <p className="text-fg-2 text-sm leading-relaxed">
                Pounds of direct CO₂ emitted per MWh generated (
                <code className="border-edge bg-surface text-fg rounded border px-1.5 py-0.5 font-mono text-xs">
                  lbs/MWh
                </code>
                ). Gas CCGT ~800, Coal ~2,100, Renewables/Nuclear = 0.
              </p>
            </div>

            <div className="border-edge/80 bg-canvas/60 col-span-1 space-y-2 rounded-lg border p-3.5 sm:col-span-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-400">
                <ShieldCheck className="h-4 w-4" />
                <span>Automated Thermodynamic Auditing</span>
              </div>
              <p className="text-fg-2 text-sm leading-relaxed">
                Continuous rule validation detecting thermodynamic discrepancies
                such as out-of-bounds heat rates, phantom power generation, or
                zero-emissions combustion flags.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
