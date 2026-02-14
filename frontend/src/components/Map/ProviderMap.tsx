import { useState, useMemo, useEffect, useCallback } from "react";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { FlyToInterpolator } from "@deck.gl/core";
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

const DOT_COLOR: [number, number, number] = [37, 99, 235];
const HIGHLIGHT_COLOR: [number, number, number] = [255, 0, 0];

// Linear scale: largest providers (~$500M) get ~30px, smallest get 2px
const MAX_PAID = 5e8;
function radiusForPaid(paid: number): number {
  return 2 + (Math.min(paid, MAX_PAID) / MAX_PAID) * 28;
}

export function ProviderMap() {
  const { selectedState, selectedNpi, setSelectedNpi } = useDashboard();
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    provider: MapProvider;
  } | null>(null);

  const { data, loading } = useApi(
    () => api.mapProviders({ state: selectedState ?? undefined, limit: 5000 }),
    [selectedState]
  );

  // Fly to selected provider
  useEffect(() => {
    if (!selectedNpi || !data) return;
    const provider = data.find((d) => d.npi === selectedNpi);
    if (provider) {
      setViewState((prev) => ({
        ...prev,
        longitude: provider.lng,
        latitude: provider.lat,
        zoom: 11,
        transitionDuration: 1200,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [selectedNpi, data]);

  // Reset view when clearing selection
  useEffect(() => {
    if (!selectedNpi && !selectedState) {
      setViewState((prev) => ({
        ...prev,
        ...INITIAL_VIEW,
        transitionDuration: 800,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [selectedNpi, selectedState]);

  const handleViewStateChange = useCallback(({ viewState: vs }: { viewState: typeof INITIAL_VIEW }) => {
    setViewState(vs);
  }, []);

  const layer = useMemo(() => {
    if (!data) return null;
    return new ScatterplotLayer<MapProvider>({
      id: "providers",
      data,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => radiusForPaid(d.total_paid),
      radiusUnits: "pixels" as const,
      getFillColor: (d) =>
        selectedNpi && d.npi === selectedNpi ? HIGHLIGHT_COLOR : DOT_COLOR,
      pickable: true,
      opacity: 0.6,
      updateTriggers: {
        getFillColor: [selectedNpi],
      },
      onClick: ({ object }) => {
        if (object) setSelectedNpi(object.npi);
      },
      onHover: ({ object, x, y }) => {
        if (object) setTooltip({ x, y, provider: object });
        else setTooltip(null);
      },
    });
  }, [data, selectedNpi, setSelectedNpi]);

  return (
    <div className="map-container">
      {loading && <div className="map-loading">Loading providers...</div>}
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
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
