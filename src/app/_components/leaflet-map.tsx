"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getFuelTheme,
  getMarkerRadius,
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

    // Continental USA initial center
    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      minZoom: 3,
      maxZoom: 20,
      zoomControl: false,
    });

    const cartoKey = process.env.NEXT_PUBLIC_CARTO_API;
    const tileUrl = cartoKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoKey}`
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    const attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>';

    L.tileLayer(tileUrl, {
      attribution,
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

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

      const radius = getMarkerRadius(plant, metricMode, { uniformBase: 5 });

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
          <div class="font-semibold text-fg">${plant.name} (${plant.stateCode})</div>
          <div class="text-xs text-fg-muted">${theme.name} • ${plant.totalCapacityMW.toLocaleString()} MW</div>
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
    <div className="relative isolate z-0 h-[420px] sm:h-[520px] lg:h-[620px] w-full overflow-hidden rounded-xl border border-edge/80 bg-surface/20 shadow-xs">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating Instructions */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-2 text-xs text-fg-muted">
        <div className="rounded-md border border-edge/80 bg-surface/90 px-3 py-1.5 backdrop-blur-md shadow-xs">
          <span>Leaflet Mercator Map • Click any marker to view full facility profile</span>
        </div>
      </div>
    </div>
  );
}

