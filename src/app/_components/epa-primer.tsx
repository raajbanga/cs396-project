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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export function EpaPrimer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-xs transition-all">
      {/* Banner Header with Toggle */}
      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                Demystifying EPA CAMPD & Electric Grid Data
              </span>
              <Badge variant="outline" className="py-0 font-mono text-[10px]">
                101 Primer
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400">
              New to power generation data? Learn how ORISPL codes, NERC grids,
              carbon intensity, and sanity checks work.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className="h-7 gap-1.5 self-start text-xs sm:self-auto"
        >
          {isOpen ? (
            <>
              <span>Hide Guide</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span>Quick Data Guide</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>

      {/* Expanded Educational Cards Grid */}
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 border-t border-zinc-800/80 p-4 pt-3 text-xs duration-200">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Card 1: ORISPL */}
            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <Building2 className="h-3.5 w-3.5" />
                <span>ORISPL Plant Code</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-300">
                A unique permanent federal facility identifier assigned by the
                Department of Energy (DOE/EIA). It acts like a Social Security
                Number for every power plant in the United States.
              </p>
            </div>

            {/* Card 2: NERC Grids */}
            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-sky-400">
                <Globe className="h-3.5 w-3.5" />
                <span>NERC Reliability Grids</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-300">
                Regional electric reliability councils (e.g.{" "}
                <strong>ERCOT</strong> in Texas, <strong>WECC</strong> in the
                West, <strong>SERC</strong> in Southeast, <strong>RFC</strong>{" "}
                in Mid-Atlantic). Grids operate as independent synchronized
                power pools.
              </p>
            </div>

            {/* Card 3: Capacity & Scale */}
            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                <Zap className="h-3.5 w-3.5" />
                <span>Nameplate Capacity (MW)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-300">
                The maximum continuous power output of the plant. As a rule of
                thumb, <strong>1 Megawatt (MW)</strong> can power approximately{" "}
                <strong>750 to 1,000 average homes</strong>. A 1,000 MW plant
                powers ~750K homes.
              </p>
            </div>

            {/* Card 4: Carbon Intensity */}
            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <Activity className="h-3.5 w-3.5" />
                <span>Carbon Intensity</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-300">
                Emissions efficiency: pounds of CO2 emitted per MWh generated (
                <code className="font-mono text-[10px] text-emerald-300">
                  lbs/MWh
                </code>
                ). Clean Gas CCGT = ~800, Peakers = ~1,200, Coal = ~2,100,
                Solar/Nuclear = 0.
              </p>
            </div>

            {/* Card 5: Sanity Auditing */}
            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-red-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Physical Sanity Audits</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-300">
                Automated thermodynamic audits enforcing physical laws: flags
                impossible reports like burning vast fuel with 0 CO2 emissions,
                or claiming generation with 0 operating hours.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
