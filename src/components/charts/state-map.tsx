"use client";

import { useEffect, useState } from "react";
import {
  geoAlbersUsa,
  geoPath,
  scaleSequential,
  type GeoPermissibleObjects,
} from "d3";
import * as topojson from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { formatTick, formatValue, TooltipCard } from "~/components/ui/chart";
import { STATE_NAMES } from "~/lib/describe-search";
import { colorRamp, HoverCard, useHover, useTokens, useWidth } from "./svg";

type StateShape = GeoPermissibleObjects & {
  properties: { name: string };
};

/** The U.S. state outlines (the Map page's file), loaded once per session. */
let shapes: Promise<StateShape[]> | undefined;
const loadShapes = () =>
  (shapes ??= fetch("/geo/us-states-10m.json")
    .then(
      (r) =>
        r.json() as Promise<
          Topology<{ states: GeometryCollection<{ name: string }> }>
        >,
    )
    .then(
      (topo) =>
        topojson.feature(topo, topo.objects.states)
          .features as unknown as StateShape[],
    ));

const TOKENS = ["surface-2", "chart-ochre", "chart-rust"] as const;
const RATIO = 0.62;

/**
 * A state choropleth: a warm ramp from the panel color through ochre to rust, states without a
 * value left as outlines, and a gradient key under the map.
 */
export function StateMap({
  values,
  unit,
  details,
}: {
  /** Postal code → value. */
  values: Record<string, number | null>;
  unit: string;
  /** Extra hover lines per state, e.g. its unit-year count. */
  details?: (code: string) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [states, setStates] = useState<StateShape[]>([]);
  const { hover, on } = useHover<{ code: string; name: string }>();
  const t = useTokens(TOKENS);
  useEffect(() => {
    void loadShapes().then(setStates);
  }, []);
  const height = Math.round(width * RATIO);
  const known = Object.values(values).filter((v): v is number => v != null);
  const max = Math.max(1, ...known);
  const color =
    t &&
    scaleSequential(
      colorRamp([t["surface-2"], t["chart-ochre"], t["chart-rust"]]),
    ).domain([0, max]);
  const path = geoPath(
    geoAlbersUsa().fitSize([width, height], {
      type: "FeatureCollection",
      features: states,
    } as GeoPermissibleObjects),
  );
  const hovered = hover && values[hover.item.code];
  return (
    <div className="space-y-2">
      <div
        ref={ref}
        className="relative w-full"
        style={{ height: height || 300 }}
      >
        {width > 0 && color && (
          <svg width={width} height={height}>
            {states.map((s) => {
              const code = STATE_NAMES[s.properties.name.toLowerCase()] ?? "";
              const v = values[code];
              return (
                <path
                  key={s.properties.name}
                  d={path(s) ?? undefined}
                  fill={v == null ? "transparent" : color(v)}
                  stroke={
                    hover?.item.code === code ? "var(--fg)" : "var(--edge)"
                  }
                  strokeWidth={hover?.item.code === code ? 1.5 : 0.75}
                  {...on({ code, name: s.properties.name })}
                />
              );
            })}
          </svg>
        )}
        <HoverCard at={hover} width={width}>
          {hover && (
            <TooltipCard
              title={hover.item.name}
              rows={[
                {
                  label: unit,
                  value: hovered == null ? "No value" : formatValue(hovered),
                },
              ]}
              footer={details?.(hover.item.code)}
            />
          )}
        </HoverCard>
      </div>
      {color && (
        <div className="text-fg-muted flex items-center gap-2 text-xs">
          <span>0</span>
          <span
            className="h-2 w-40 rounded-full"
            style={{
              background: `linear-gradient(to right, ${color(0)}, ${color(max / 2)}, ${color(max)})`,
            }}
          />
          <span>
            {formatTick(max)} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
