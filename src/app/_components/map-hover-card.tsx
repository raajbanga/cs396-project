import { FuelBadge } from "~/components/ui/badge";
import { type MapFacility } from "~/lib/map-utils";
import { formatCountyShort } from "~/lib/plant-narrative";
import { formatQuantity } from "~/lib/utils";

const CARD_WIDTH = 256;
const CARD_HEIGHT = 190;

/** The facility under the pointer on either map, placed beside it and kept inside the frame. */
export function MapHoverCard({
  plant,
  x,
  y,
  frame,
}: {
  plant: MapFacility;
  x: number;
  y: number;
  frame: { width: number; height: number };
}) {
  const left = x + 16 + CARD_WIDTH < frame.width ? x + 16 : x - 16 - CARD_WIDTH;
  const top = Math.max(8, Math.min(y - 24, frame.height - CARD_HEIGHT - 8));
  return (
    <div
      style={{ left: Math.max(8, left), top, width: CARD_WIDTH }}
      className="border-edge bg-surface pointer-events-none absolute z-[1000] rounded-md border p-3 text-sm shadow-lg shadow-black/10"
    >
      <p className="text-fg leading-snug font-medium">{plant.name}</p>
      <p className="text-fg-muted text-xs">
        {plant.id} ·{" "}
        {plant.county ? `${formatCountyShort(plant.county)}, ` : ""}
        {plant.stateCode}
      </p>
      <div className="mt-1.5">
        <FuelBadge fuel={plant.primaryFuel} />
      </div>
      <dl className="border-edge mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-2 text-xs">
        {[
          [
            "Capacity",
            formatQuantity(plant.totalCapacityMW, "MW", { digits: 1 }),
          ],
          ["CO₂", formatQuantity(plant.totalCo2Tons, "t")],
          ["Units", String(plant.unitCount)],
          ["Grid", plant.nercRegion ?? "—"],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="text-fg-muted">{term}</dt>
            <dd className="text-fg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-fg-muted mt-2 text-xs">Click for details</p>
    </div>
  );
}
