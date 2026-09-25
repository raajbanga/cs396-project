"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { env } from "~/env";
import {
  getFuelTheme,
  getMarkerRadius,
  MAP_FRAME,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import { cn } from "~/lib/utils";

const cartoKey = env.NEXT_PUBLIC_CARTO_API;
const TILE_URL = cartoKey
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoKey}`
  : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export function LeafletMap({
  facilities,
  onInspectFacility,
  metricMode,
}: {
  facilities: MapFacility[];
  onInspectFacility: (id: number) => void;
  metricMode: MetricMode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.8283, -98.5795], // continental US
      zoom: 4,
      minZoom: 3,
      maxZoom: 20,
      zoomControl: false,
    });
    L.tileLayer(TILE_URL, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layerGroup = layerGroupRef.current;
    if (!layerGroup) return;
    layerGroup.clearLayers();

    for (const plant of facilities) {
      const theme = getFuelTheme(plant.primaryFuel);
      L.circleMarker([plant.latitude, plant.longitude], {
        radius: getMarkerRadius(plant, metricMode, { uniformBase: 5 }),
        fillColor: theme.color,
        color: "#09090b",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.85,
      })
        .bindTooltip(
          `<div class="text-xs font-sans">
            <div class="font-semibold text-fg">${plant.name} (${plant.stateCode})</div>
            <div class="text-xs text-fg-muted">${theme.name} • ${plant.totalCapacityMW.toLocaleString()} MW</div>
          </div>`,
          {
            direction: "top",
            className: "leaflet-dark-tooltip",
            opacity: 0.95,
          },
        )
        .on("click", () => onInspectFacility(plant.id))
        .addTo(layerGroup);
    }
  }, [facilities, metricMode, onInspectFacility]);

  return (
    <div className={cn(MAP_FRAME, "bg-surface/20 isolate z-0")}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="border-edge/80 bg-surface/90 text-fg-muted pointer-events-none absolute bottom-3 left-3 z-10 hidden rounded-md border px-3 py-1.5 text-xs shadow-xs backdrop-blur-md sm:block">
        Leaflet Mercator Map • Click any marker to view full facility profile
      </div>
    </div>
  );
}
