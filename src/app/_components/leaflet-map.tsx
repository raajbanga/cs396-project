"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import { env } from "~/env";
import {
  getFuelTheme,
  getMarkerRadius,
  MAP_FRAME,
  readThemeColors,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";
import { cn } from "~/lib/utils";
import { MapHoverCard } from "./map-hover-card";

const cartoKey = env.NEXT_PUBLIC_CARTO_API;

/** CARTO basemap matching the theme; without a key only the public dark tiles are available. */
const tileUrl = (dark: boolean) =>
  cartoKey
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png?key=${cartoKey}`
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
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [hovered, setHovered] = useState<{
    plant: MapFacility;
    x: number;
    y: number;
  } | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.8283, -98.5795], // continental US
      zoom: 4,
      minZoom: 3,
      maxZoom: 20,
      zoomControl: false,
    });
    tilesRef.current = L.tileLayer(tileUrl(false), {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on("movestart", () => setHovered(null));

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    tilesRef.current?.setUrl(tileUrl(isDark));
  }, [isDark]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();
    const { canvas } = readThemeColors();

    for (const plant of facilities) {
      L.circleMarker([plant.latitude, plant.longitude], {
        radius: getMarkerRadius(plant, metricMode, { uniformBase: 5 }),
        fillColor: getFuelTheme(plant.primaryFuel).color,
        color: canvas,
        weight: 1,
        opacity: 1,
        fillOpacity: 0.85,
      })
        .on("mouseover", (e: L.LeafletMouseEvent) =>
          setHovered({ plant, ...map.latLngToContainerPoint(e.latlng) }),
        )
        .on("mouseout", () => setHovered(null))
        .on("click", () => onInspectFacility(plant.id))
        .addTo(layerGroup);
    }
  }, [facilities, metricMode, onInspectFacility, isDark]);

  const container = containerRef.current;
  return (
    <div className={cn(MAP_FRAME, "isolate z-0")}>
      <div ref={containerRef} className="h-full w-full" />
      {hovered && container && (
        <MapHoverCard
          {...hovered}
          frame={{
            width: container.clientWidth,
            height: container.clientHeight,
          }}
        />
      )}
      <p className="text-fg-muted bg-canvas/80 pointer-events-none absolute bottom-0 left-0 z-[500] rounded-tr-md px-3 py-1 text-xs">
        Scroll or pinch to zoom; click a dot for details.
      </p>
    </div>
  );
}
