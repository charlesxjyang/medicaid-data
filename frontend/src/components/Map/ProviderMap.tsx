import { useState, useMemo, useEffect, useCallback } from "react";
import { Map } from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { FlyToInterpolator } from "@deck.gl/core";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars } from "../../utils";
import type { MapProvider, ProviderDetail } from "../../types/api";
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
const EXCLUDED_COLOR: [number, number, number] = [220, 38, 38]; // red
const HIGHLIGHT_COLOR: [number, number, number] = [250, 204, 21]; // gold
const PROCEDURE_COLOR: [number, number, number] = [234, 88, 12]; // orange

// Linear scale: largest providers (~$500M) get ~30px, smallest get 2px
const MAX_PAID = 5e8;
function radiusForPaid(paid: number): number {
  return 2 + (Math.min(paid, MAX_PAID) / MAX_PAID) * 28;
}

function detailToMapProvider(d: ProviderDetail): MapProvider | null {
  if (!d.lat || !d.lng) return null;
  return {
    npi: d.npi,
    name: d.name,
    state: d.state,
    city: d.city,
    lat: d.lat,
    lng: d.lng,
    total_paid: d.total_paid,
    total_claims: d.total_claims,
    total_beneficiaries: d.total_beneficiaries ?? 0,
  };
}

export function ProviderMap() {
  const { selectedState, selectedNpi, selectedProcedure, excludedOnly, setSelectedNpi } = useDashboard();
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    provider: MapProvider;
    isProcedure?: boolean;
  } | null>(null);

  const { data, loading } = useApi(
    () => api.mapProviders({ state: selectedState ?? undefined, limit: excludedOnly ? 1000 : 5000, excluded_only: excludedOnly }),
    [selectedState, excludedOnly]
  );

  const { data: procData } = useApi(
    () =>
      selectedProcedure
        ? api.mapProvidersByProcedure(selectedProcedure, selectedState ?? undefined)
        : Promise.resolve(null),
    [selectedProcedure, selectedState]
  );

  const { data: procDetail } = useApi(
    () =>
      selectedProcedure
        ? api.procedureDetail(selectedProcedure)
        : Promise.resolve(null),
    [selectedProcedure]
  );

  // Fetch selected provider detail for highlight dot
  const { data: selectedDetail } = useApi(
    () => (selectedNpi ? api.providerDetail(selectedNpi) : Promise.resolve(null)),
    [selectedNpi]
  );

  // Fly to selected provider
  useEffect(() => {
    if (!selectedNpi || !selectedDetail) return;
    if (selectedDetail.lat && selectedDetail.lng) {
      setViewState((prev) => ({
        ...prev,
        longitude: selectedDetail.lng!,
        latitude: selectedDetail.lat!,
        zoom: 11,
        transitionDuration: 1200,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [selectedNpi, selectedDetail]);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleViewStateChange = useCallback(({ viewState: vs }: any) => {
    setViewState(vs);
  }, []);

  const layers = useMemo(() => {
    const result = [];

    // Base layer: all providers (blue normally, red when showing excluded only)
    if (data) {
      result.push(
        new ScatterplotLayer<MapProvider>({
          id: "providers",
          data,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: (d) => radiusForPaid(d.total_paid),
          radiusUnits: "pixels" as const,
          getFillColor: excludedOnly ? EXCLUDED_COLOR : DOT_COLOR,
          pickable: !selectedProcedure,
          opacity: selectedProcedure ? 0.15 : excludedOnly ? 0.8 : 0.6,
          updateTriggers: {
            opacity: [selectedProcedure, excludedOnly],
            getFillColor: [excludedOnly],
          },
          onClick: ({ object }) => {
            if (object) setSelectedNpi(object.npi);
          },
          onHover: ({ object, x, y }) => {
            if (!selectedProcedure) {
              if (object) setTooltip({ x, y, provider: object });
              else setTooltip(null);
            }
          },
        })
      );
    }

    // Procedure layer: providers for selected procedure (orange)
    if (procData && selectedProcedure) {
      result.push(
        new ScatterplotLayer<MapProvider>({
          id: "procedure-providers",
          data: procData,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: (d) => radiusForPaid(d.total_paid),
          radiusUnits: "pixels" as const,
          getFillColor: PROCEDURE_COLOR,
          pickable: true,
          opacity: 0.7,
          onClick: ({ object }) => {
            if (object) setSelectedNpi(object.npi);
          },
          onHover: ({ object, x, y }) => {
            if (object) setTooltip({ x, y, provider: object, isProcedure: true });
            else setTooltip(null);
          },
        })
      );
    }

    // Highlight layer: always show selected provider on top
    if (selectedNpi && selectedDetail) {
      const mp = detailToMapProvider(selectedDetail);
      if (mp) {
        result.push(
          new ScatterplotLayer<MapProvider>({
            id: "selected-provider",
            data: [mp],
            getPosition: (d) => [d.lng, d.lat],
            getRadius: 14,
            radiusUnits: "pixels" as const,
            getFillColor: HIGHLIGHT_COLOR,
            getLineColor: [0, 0, 0],
            getLineWidth: 2,
            stroked: true,
            lineWidthUnits: "pixels" as const,
            pickable: true,
            opacity: 1,
            onHover: ({ object, x, y }) => {
              if (object) setTooltip({ x, y, provider: object });
              else setTooltip(null);
            },
          })
        );
      }
    }

    return result;
  }, [data, procData, selectedNpi, selectedDetail, selectedProcedure, excludedOnly, setSelectedNpi]);

  return (
    <div className="map-container">
      {loading && <div className="map-loading">Loading providers...</div>}
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={true}
        layers={layers}
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
          {tooltip.isProcedure && (
            <>
              <br />
              {tooltip.provider.total_claims.toLocaleString()} claims
            </>
          )}
        </div>
      )}
      {selectedProcedure && (
        <div className="map-legend">
          <div className="map-legend-item">
            <span className="map-legend-dot" style={{ background: `rgb(${PROCEDURE_COLOR.join(",")})` }} />
            {procDetail
              ? `${procDetail.hcpcs_code} — ${procDetail.description?.length > 32 ? procDetail.description.slice(0, 30) + "..." : procDetail.description}`
              : selectedProcedure}
          </div>
          <div className="map-legend-item">
            <span className="map-legend-dot" style={{ background: `rgb(${DOT_COLOR.join(",")})`, opacity: 0.3 }} />
            All providers
          </div>
          <div className="map-legend-hint">Dot size = total reimbursements</div>
        </div>
      )}
    </div>
  );
}
