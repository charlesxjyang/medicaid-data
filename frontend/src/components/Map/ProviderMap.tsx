import { useState, useMemo } from "react";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars } from "../../utils";
import type { MapProvider } from "../../types/api";
import "maplibre-gl/dist/maplibre-gl.css";

const INITIAL_VIEW = {
  longitude: -98.5,
  latitude: 39.8,
  zoom: 3.8,
  pitch: 0,
  bearing: 0,
};

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const DOT_COLOR: [number, number, number, number] = [37, 99, 235, 160]; // blue

function radiusForPaid(paid: number): number {
  // Log scale in pixels: ~$10K → 2px, ~$1B+ → 20px
  const logVal = Math.log10(Math.max(paid, 1));
  // logVal ranges roughly 4 ($10K) to 10 ($10B)
  return 2 + Math.max(0, logVal - 4) * 3;
}

export function ProviderMap() {
  const { selectedState, setSelectedNpi } = useDashboard();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    provider: MapProvider;
  } | null>(null);

  const { data, loading } = useApi(
    () => api.mapProviders({ state: selectedState ?? undefined, limit: 5000 }),
    [selectedState]
  );

  const layer = useMemo(() => {
    if (!data) return null;
    return new ScatterplotLayer<MapProvider>({
      id: "providers",
      data,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => radiusForPaid(d.total_paid),
      radiusUnits: "pixels" as const,
      getFillColor: DOT_COLOR,
      pickable: true,
      opacity: 0.8,
      onClick: ({ object }) => {
        if (object) setSelectedNpi(object.npi);
      },
      onHover: ({ object, x, y }) => {
        if (object) setTooltip({ x, y, provider: object });
        else setTooltip(null);
      },
    });
  }, [data, setSelectedNpi]);

  return (
    <div className="map-container">
      {loading && <div className="map-loading">Loading providers...</div>}
      <DeckGL
        initialViewState={INITIAL_VIEW}
        controller={true}
        layers={layer ? [layer] : []}
        getTooltip={null}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
      {tooltip && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}
        >
          <strong>{tooltip.provider.name}</strong>
          <br />
          {tooltip.provider.city}, {tooltip.provider.state}
          <br />
          {fmtDollars(tooltip.provider.total_paid)}
        </div>
      )}
    </div>
  );
}
