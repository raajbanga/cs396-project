"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getFuelTheme,
  type MapFacility,
  type MetricMode,
} from "~/lib/map-utils";

interface LeafletMapProps {
  facilities: MapFacility[];
  selectedFacilityId?: number | null;
  onInspectFacility: (id: number) => void;
  metricMode: MetricMode;
}

export function LeafletMap({
  facilities,
  selectedFacilityId,
  onInspectFacility,
  metricMode,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center on continental USA
    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      zoomControl: false,
    });

    // Dark theme CartoDB basemap tiles
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);

    // Zoom control in top right
    L.control.zoom({ position: "topright" }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Update markers when facilities, metricMode, or selectedFacilityId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    facilities.forEach((plant) => {
      const theme = getFuelTheme(plant.primaryFuel);

      let radius = 5;
      if (metricMode === "capacity") {
        radius = Math.max(3, Math.min(14, Math.sqrt(plant.totalCapacityMW) * 0.15));
      } else if (metricMode === "co2") {
        radius = Math.max(3, Math.min(14, Math.sqrt(plant.totalCo2Tons) * 0.0035));
      }

      const isSelected = selectedFacilityId === plant.id;

      const marker = L.circleMarker([plant.latitude, plant.longitude], {
        radius: isSelected ? radius + 3 : radius,
        fillColor: theme.color,
        color: isSelected ? "#ffffff" : "#09090b",
        weight: isSelected ? 2 : 1,
        opacity: 1,
        fillOpacity: 0.85,
      });

      // Hover tooltip
      marker.bindTooltip(
        `<div class="text-xs font-sans">
          <div class="font-semibold text-zinc-100">${plant.name} (${plant.stateCode})</div>
          <div class="text-[11px] text-zinc-400">${theme.name} • ${plant.totalCapacityMW.toLocaleString()} MW</div>
        </div>`,
        {
          direction: "top",
          className: "leaflet-dark-tooltip",
          opacity: 0.95,
        },
      );

      // Click to inspect
      marker.on("click", () => {
        onInspectFacility(plant.id);
      });

      marker.addTo(layerGroup);
    });
  }, [facilities, metricMode, selectedFacilityId, onInspectFacility]);

  return (
    <div className="relative h-[620px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating Instructions */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] flex items-center gap-2 text-[11px] text-zinc-400">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 backdrop-blur-md shadow-md">
          <span>Leaflet Mercator Map • Click any marker to view full facility profile</span>
        </div>
      </div>
    </div>
  );
}

