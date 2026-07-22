import { Link } from "react-router-dom";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import L from "leaflet";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import type { FeatureCollection } from "geojson";
import {
  ChevronDown,
  ChevronUp,
  Droplets,
  ExternalLink,
  MapPin,
  Maximize2,
  Sun,
} from "lucide-react";

import { LivePulseBadge } from "@/components/LivePulseBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { hqRoutes } from "@/constants/routes";
import { getApiErrorMessage } from "../../lib/api-error";
import { toast } from "sonner";
import {
  getSolarSystems,
  getWaterSystems,
} from "../../services/tehsilManagerOperatorService";
import type { QueryFilters } from "../../services/types";
import type { SolarSystemRow, WaterSystemRow } from "../../types/api";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import type {
  ProgramSolarSystemCoverage,
  ProgramWaterSystemCoverage,
} from "./fetchScopedProgramDashboard";
import {
  formatAdminDate,
  formatSolarPeriod,
} from "./AdminDashboardBlocks";
import { PAGE_SIZE } from "./useClientPagination";

import pakistanOutlineJson from "../../data/pakistan-outline.json";
import punjabPkBoundaryJson from "../../data/punjab-pk-boundary.json";

import "leaflet/dist/leaflet.css";

const pakistanOutline = pakistanOutlineJson as FeatureCollection;
const punjabPkBoundary = punjabPkBoundaryJson as unknown as FeatureCollection;

type GeoPoint = {
  id: string;
  systemId: string;
  type: "water" | "solar";
  uid: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  latitude: number;
  longitude: number;
  approximate?: boolean;
};

export type SystemsMapFilters = {
  tehsil: string;
  village: string;
};

const PAKISTAN_VIEW_BOUNDS_LNGLAT: [[number, number], [number, number]] = [
  [60.45, 23.25],
  [78.05, 37.25],
];

const MAP_MAX_BOUNDS_LEAFLET: L.LatLngBoundsExpression = [
  [22.5, 59.5],
  [38.0, 79.0],
];

/** Esri World Street Map — executive dashboard basemap. */
const ESRI_WORLD_STREET_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const CARTO_LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowLatLng(row: Record<string, unknown>): {
  lat: number | null;
  lng: number | null;
} {
  const lat = toNumber(row.latitude ?? row.lat ?? row.Latitude);
  const lng = toNumber(row.longitude ?? row.lng ?? row.lon ?? row.Longitude);
  return { lat, lng };
}

function normalizeListPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.systems)) return o.systems;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

function approximateLatLng(
  seed: string,
  type: "water" | "solar",
): { latitude: number; longitude: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = ((h >>> 0) % 10001) / 10000;
  const v = (((h * 1103515245) >>> 0) % 10001) / 10000;
  const lat = 29.0 + u * 5.8;
  const lng = 69.8 + v * 8.2;
  const nudge = type === "solar" ? 0.04 : -0.04;
  return {
    latitude: lat + nudge * (u - 0.5),
    longitude: lng + nudge * (v - 0.5),
  };
}

function createTeardropPinIcon(p: GeoPoint): L.DivIcon {
  const fill = p.type === "water" ? "#2563eb" : "#d97706";
  const ring = p.approximate ? "#94a3b8" : "#ffffff";
  const dash = p.approximate ? 'stroke-dasharray="4 3"' : "";
  const html = `<div class="hq-leaflet-pin-wrap" aria-hidden="true">
    <svg width="40" height="52" viewBox="0 0 64 84" xmlns="http://www.w3.org/2000/svg">
      <path fill="${fill}" stroke="${ring}" stroke-width="3" stroke-linejoin="round" ${dash}
        d="M32 4C17.6 4 6 15.2 6 29.2c0 16.5 22.2 46.4 24.6 49.4.9 1.1 2.3 1.1 3.2 0C36.2 75.6 58 45.7 58 29.2 58 15.2 46.4 4 32 4z"/>
      <circle cx="32" cy="28" r="9" fill="#ffffff"/>
    </svg>
  </div>`;
  return L.divIcon({
    className: "hq-leaflet-pin-icon",
    html,
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -48],
  });
}

function MapViewBounds({
  points,
  ready,
}: {
  points: GeoPoint[];
  ready: boolean;
}) {
  const map = useMap();
  const signature = useMemo(
    () => points.map((p) => `${p.id}:${p.latitude},${p.longitude}`).join("|"),
    [points],
  );

  useEffect(() => {
    if (!ready) return;
    map.invalidateSize();
    if (points.length === 0) {
      const [[west, south], [east, north]] = PAKISTAN_VIEW_BOUNDS_LNGLAT;
      const bounds = L.latLngBounds(
        L.latLng(south, west),
        L.latLng(north, east),
      );
      map.fitBounds(bounds, {
        padding: [20, 64],
        maxZoom: 6.4,
        animate: false,
      });
      return;
    }
    if (points.length === 1) {
      const only = points[0];
      if (!only) return;
      map.setView([only.latitude, only.longitude], 10, { animate: false });
      return;
    }
    const latlngs = points.map((p) => L.latLng(p.latitude, p.longitude));
    const bounds = L.latLngBounds(latlngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12, animate: false });
    }
  }, [map, ready, signature]);

  return null;
}

function mapListQuery(filters: SystemsMapFilters): QueryFilters {
  return {
    tehsil: filters.tehsil,
    village: filters.village,
  };
}

function MapLegend({ compact }: { compact?: boolean | undefined }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-2 left-2 z-[10] flex flex-wrap gap-1.5 rounded-md border border-border/70 bg-background/95 px-2 py-1.5 shadow-sm ${
        compact ? "text-[10px]" : "text-xs"
      }`}
    >
      <span className="flex items-center gap-1 font-medium text-foreground">
        <span className="size-2 rounded-full bg-blue-600" />
        Water system
      </span>
      <span className="flex items-center gap-1 font-medium text-foreground">
        <span className="size-2 rounded-full bg-amber-600" />
        Solar system
      </span>
      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="size-2 rounded-full border border-dashed border-slate-400 bg-transparent" />
        Approx. location
      </span>
    </div>
  );
}

const SystemsMapCanvas = memo(function SystemsMapCanvas({
  mapRef,
  points,
  loading,
  heightClass,
  onReady,
  scopeLabel,
  compact,
  lightBasemap,
  selectedId,
  onSelect,
}: {
  mapRef: MutableRefObject<L.Map | null>;
  points: GeoPoint[];
  loading: boolean;
  heightClass: string;
  onReady: () => void;
  scopeLabel?: string | undefined;
  compact?: boolean | undefined;
  lightBasemap?: boolean | undefined;
  selectedId?: string | null;
  onSelect?: (point: GeoPoint) => void;
}) {
  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-slate-50/80 to-muted/30 shadow-inner [&_.leaflet-container]:z-0 ${heightClass}`}
    >
      {scopeLabel ? (
        <div className="pointer-events-none absolute left-2 top-2 z-[10] max-w-[min(calc(100%-4.5rem),220px)] rounded-md border border-border/70 bg-background/95 px-2 py-1 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Active scope
          </p>
          <p className="truncate text-[11px] font-medium text-foreground">
            {scopeLabel}
          </p>
        </div>
      ) : null}
      {loading ? (
        <div
          className="absolute inset-0 z-[20] flex items-center justify-center bg-background/55"
          aria-live="polite"
        >
          <div className="rounded-lg border bg-background/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm">
            Updating map…
          </div>
        </div>
      ) : null}
      <MapContainer
        ref={mapRef}
        center={[30.5, 69.5]}
        zoom={5}
        minZoom={5}
        maxZoom={12}
        maxBounds={MAP_MAX_BOUNDS_LEAFLET}
        maxBoundsViscosity={1.0}
        className={`w-full rounded-[inherit] ${heightClass}`}
        scrollWheelZoom
        whenReady={onReady}
      >
        <TileLayer
          attribution={lightBasemap ? CARTO_ATTRIBUTION : TILE_ATTRIBUTION}
          url={lightBasemap ? CARTO_LIGHT_TILES : ESRI_WORLD_STREET_TILES}
        />
        <ZoomControl position="bottomright" />
        <MapViewBounds points={points} ready={!loading} />
        <GeoJSON
          data={pakistanOutline}
          style={{
            color: "#94a3b8",
            weight: 1,
            fillColor: "#64748b",
            fillOpacity: 0.06,
            opacity: 0.7,
          }}
        />
        <GeoJSON
          data={punjabPkBoundary}
          style={{
            color: "#047857",
            weight: 2,
            fillColor: "#10b981",
            fillOpacity: 0.12,
            opacity: 0.9,
          }}
        />
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={createTeardropPinIcon(p)}
            opacity={selectedId && selectedId !== p.id ? 0.45 : 1}
            eventHandlers={{
              click: () => onSelect?.(p),
            }}
          />
        ))}
      </MapContainer>
      <MapLegend compact={compact} />
    </div>
  );
});

type SystemsMapCardProps = {
  mapFilters: SystemsMapFilters;
  allowedTehsils?: string[];
  summaryCounts?: { water: number; solar: number } | null | undefined;
  /** Shorter preview with expand-to-fullscreen option (COO dashboard). */
  compact?: boolean;
  /**
   * `hero` — full-width Command Center map (always open, taller, live pulse).
   * Default / compact — collapsible inline map.
   */
  variant?: "default" | "hero";
  /** Human-readable scope — shown on map and kept in sync with KPI filters. */
  scopeLabel?: string | undefined;
  /** Parent KPI reload in progress — badge counts stay on summary values. */
  dataSyncing?: boolean;
  /** Coverage from program-summary for selected-site analytics. */
  waterCoverage?: ProgramWaterSystemCoverage[];
  solarCoverage?: ProgramSolarSystemCoverage[];
  /** Start collapsed to keep KPI/issues primary (default true for compact). */
  defaultCollapsed?: boolean;
};

function SiteDetailPanel({
  point,
  waterCoverage,
  solarCoverage,
  onClose,
}: {
  point: GeoPoint;
  waterCoverage: ProgramWaterSystemCoverage[];
  solarCoverage: ProgramSolarSystemCoverage[];
  onClose: () => void;
}) {
  const water = waterCoverage.find((s) => s.id === point.systemId);
  const solar = solarCoverage.find((s) => s.id === point.systemId);
  const detailHref =
    point.type === "water"
      ? hqRoutes.waterSystem(point.systemId)
      : hqRoutes.solarSite(point.systemId);

  return (
    <div className="rounded-lg border border-border/70 bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Badge variant="outline" className="mb-1 font-normal capitalize">
            {point.type === "water" ? "Water system" : "Solar system"}
          </Badge>
          <p className="truncate text-sm font-semibold">{point.uid}</p>
          <p className="text-xs text-muted-foreground">
            {[point.village, point.settlement, point.tehsil]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        {point.type === "water" && water ? (
          <>
            <div>
              <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                Logging status
              </dt>
              <dd className="mt-0.5 text-sm">
                {water.logged
                  ? `Logged · ${water.days_logged} days · ${water.logs_count} logs`
                  : "No log in selected period"}
              </dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                Last log received
              </dt>
              <dd className="mt-0.5 text-sm">
                {formatAdminDate(
                  water.last_log_date ?? water.lifetime_last_log_date,
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                Bulk meter
              </dt>
              <dd className="mt-0.5 text-sm">
                {water.bulk_meter_installed ? "Installed" : "Not installed"}
              </dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                Assigned operator
              </dt>
              <dd className="mt-0.5 text-sm">
                {(water.assigned_operators?.length ?? 0) === 0
                  ? "Unassigned"
                  : water.assigned_operators.map((o) => o.name).join(", ")}
              </dd>
            </div>
          </>
        ) : null}
        {point.type === "solar" && solar ? (
          <>
            <div>
              <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                Logging status
              </dt>
              <dd className="mt-0.5 text-sm">
                {solar.logged
                  ? `Logged · ${solar.months_logged} months · ${solar.logs_count} records`
                  : "No log in selected period"}
              </dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                Last log received
              </dt>
              <dd className="mt-0.5 text-sm">
                {formatSolarPeriod(
                  solar.lifetime_last_log_year,
                  solar.lifetime_last_log_month,
                )}
              </dd>
            </div>
          </>
        ) : null}
        {point.approximate ? (
          <div className="sm:col-span-2">
            <dt className="font-medium uppercase tracking-wide text-muted-foreground">
              Location note
            </dt>
            <dd className="mt-0.5 text-sm text-amber-800">
              Approximate pin — GPS not saved on the system record yet.
            </dd>
          </div>
        ) : null}
        {!water && !solar ? (
          <div className="sm:col-span-2 text-sm text-muted-foreground">
            Registry location only. Open details for full history and records.
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex justify-end">
        <Link
          to={detailHref}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
        >
          Explore more
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function SystemsMapCard({
  mapFilters,
  allowedTehsils = [],
  summaryCounts,
  compact = false,
  variant = "default",
  scopeLabel,
  dataSyncing = false,
  waterCoverage = [],
  solarCoverage = [],
  defaultCollapsed,
}: SystemsMapCardProps) {
  const isHero = variant === "hero";
  const mapRef = useRef<L.Map | null>(null);
  const expandedMapRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [mapOpen, setMapOpen] = useState(() => {
    if (isHero) return true;
    if (defaultCollapsed === undefined) return !compact;
    return !defaultCollapsed;
  });
  const [selected, setSelected] = useState<GeoPoint | null>(null);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [pointsTruncated, setPointsTruncated] = useState(0);
  const [registryTotals, setRegistryTotals] = useState({ water: 0, solar: 0 });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const village = mapFilters.village;

      const fetchListsForTehsil = async (tehsil: string) => {
        const q: QueryFilters = { tehsil, village };
        const [waterResult, solarResult] = await Promise.allSettled([
          getWaterSystems(q),
          getSolarSystems(q),
        ]);
        return {
          water:
            waterResult.status === "fulfilled"
              ? (normalizeListPayload(waterResult.value) as WaterSystemRow[])
              : [],
          solar:
            solarResult.status === "fulfilled"
              ? (normalizeListPayload(solarResult.value) as SolarSystemRow[])
              : [],
          waterError:
            waterResult.status === "rejected" ? waterResult.reason : null,
          solarError:
            solarResult.status === "rejected" ? solarResult.reason : null,
        };
      };

      let water: WaterSystemRow[] = [];
      let solar: SolarSystemRow[] = [];

      if (
        mapFilters.tehsil === ALL_ASSIGNED_TEHSILS &&
        allowedTehsils.length > 0
      ) {
        const results = await Promise.all(
          allowedTehsils.map((tehsil) => fetchListsForTehsil(tehsil)),
        );
        const waterById = new Map<string, WaterSystemRow>();
        const solarById = new Map<string, SolarSystemRow>();
        for (const result of results) {
          if (result.waterError) {
            toast.error(
              getApiErrorMessage(
                result.waterError,
                "Failed to load water systems for map",
              ),
            );
          }
          if (result.solarError) {
            toast.error(
              getApiErrorMessage(
                result.solarError,
                "Failed to load solar systems for map",
              ),
            );
          }
          for (const row of result.water) waterById.set(String(row.id), row);
          for (const row of result.solar) solarById.set(String(row.id), row);
        }
        water = [...waterById.values()];
        solar = [...solarById.values()];
      } else {
        const q = mapListQuery(mapFilters);
        const [waterResult, solarResult] = await Promise.allSettled([
          getWaterSystems(q),
          getSolarSystems(q),
        ]);

        if (waterResult.status === "rejected") {
          toast.error(
            getApiErrorMessage(
              waterResult.reason,
              "Failed to load water systems for map",
            ),
          );
        }
        if (solarResult.status === "rejected") {
          toast.error(
            getApiErrorMessage(
              solarResult.reason,
              "Failed to load solar systems for map",
            ),
          );
        }

        water =
          waterResult.status === "fulfilled"
            ? (normalizeListPayload(waterResult.value) as WaterSystemRow[])
            : [];
        solar =
          solarResult.status === "fulfilled"
            ? (normalizeListPayload(solarResult.value) as SolarSystemRow[])
            : [];
      }

      setRegistryTotals({ water: water.length, solar: solar.length });

      const mapped: GeoPoint[] = [];

      for (const w of water) {
        const { lat, lng } = rowLatLng(w as unknown as Record<string, unknown>);
        const hasGeo = lat != null && lng != null;
        const { latitude, longitude } = hasGeo
          ? { latitude: lat!, longitude: lng! }
          : approximateLatLng(`water|${w.id}|${w.tehsil}|${w.village}`, "water");
        mapped.push({
          id: `water-${w.id}`,
          systemId: String(w.id),
          type: "water",
          uid: String(w.unique_identifier ?? w.id),
          tehsil: String(w.tehsil ?? ""),
          village: String(w.village ?? ""),
          settlement: (w as { settlement?: string | null }).settlement ?? null,
          latitude,
          longitude,
          approximate: !hasGeo,
        });
      }

      for (const s of solar) {
        const { lat, lng } = rowLatLng(s as unknown as Record<string, unknown>);
        const hasGeo = lat != null && lng != null;
        const { latitude, longitude } = hasGeo
          ? { latitude: lat!, longitude: lng! }
          : approximateLatLng(`solar|${s.id}|${s.tehsil}|${s.village}`, "solar");
        mapped.push({
          id: `solar-${s.id}`,
          systemId: String(s.id),
          type: "solar",
          uid: String(s.unique_identifier ?? s.id),
          tehsil: String(s.tehsil ?? ""),
          village: String(s.village ?? ""),
          settlement: (s as { settlement?: string | null }).settlement ?? null,
          latitude,
          longitude,
          approximate: !hasGeo,
        });
      }

      // Prefer exact GPS pins when capping for performance.
      mapped.sort((a, b) => Number(a.approximate) - Number(b.approximate));
      const capped = mapped.slice(0, PAGE_SIZE.mapMarkers);
      setPoints(capped);
      setPointsTruncated(Math.max(0, mapped.length - capped.length));
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load systems for map"));
      setPoints([]);
      setPointsTruncated(0);
      setRegistryTotals({ water: 0, solar: 0 });
    } finally {
      setLoading(false);
    }
  }, [mapFilters.tehsil, mapFilters.village, allowedTehsils]);

  useEffect(() => {
    if (!mapOpen && !expanded) return;
    void load();
  }, [mapOpen, expanded, load]);

  useEffect(() => {
    if (mapOpen || expanded) return;
    setPoints([]);
    setPointsTruncated(0);
    setSelected(null);
  }, [mapFilters.tehsil, mapFilters.village, allowedTehsils, mapOpen, expanded]);

  useEffect(() => {
    if (!mapOpen || loading) return;
    const id = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    return () => cancelAnimationFrame(id);
  }, [mapOpen, loading, selected]);

  useEffect(() => {
    if (!expanded || loading) return;
    const timers = [50, 200, 400].map((ms) =>
      window.setTimeout(() => {
        expandedMapRef.current?.invalidateSize();
      }, ms),
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [expanded, loading, points]);

  const badgeCounts = useMemo(() => {
    if (summaryCounts != null) {
      return { water: summaryCounts.water, solar: summaryCounts.solar };
    }
    return { water: registryTotals.water, solar: registryTotals.solar };
  }, [summaryCounts, registryTotals.water, registryTotals.solar]);

  const mapBusy = loading || dataSyncing;

  const onMapReady = useCallback(() => {
    requestAnimationFrame(() => mapRef.current?.invalidateSize());
  }, []);

  const onExpandedMapReady = useCallback(() => {
    requestAnimationFrame(() => expandedMapRef.current?.invalidateSize());
    window.setTimeout(() => expandedMapRef.current?.invalidateSize(), 200);
    window.setTimeout(() => expandedMapRef.current?.invalidateSize(), 450);
  }, []);

  const previewHeight = isHero
    ? "h-[min(58vh,520px)] min-h-[360px]"
    : "h-[min(52vh,420px)] min-h-[280px]";

  return (
    <>
      <Card className="flex w-full flex-col gap-0 overflow-hidden py-0 ring-border/50">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 border-b border-border/60 bg-muted/20 py-3.5 [.border-b]:pb-3.5">
          <div className="flex items-start gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <MapPin className="size-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-semibold tracking-tight">
                  {isHero ? "Live footprint" : "Facility map"}
                </CardTitle>
                {isHero ? (
                  <LivePulseBadge syncing={mapBusy} />
                ) : null}
              </div>
              <CardDescription className="text-xs">
                {isHero
                  ? "Select a pin for status, then open the site."
                  : mapOpen
                    ? "Select a pin for site summary."
                    : "Expand to view facility locations."}
              </CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Badge
              variant="outline"
              className={`gap-1 px-2 py-0 text-xs ${mapBusy ? "opacity-60" : ""}`}
            >
              <Droplets className="size-3 text-blue-600" />
              {mapBusy ? "…" : badgeCounts.water} water
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1 px-2 py-0 text-xs ${mapBusy ? "opacity-60" : ""}`}
            >
              <Sun className="size-3 text-amber-600" />
              {mapBusy ? "…" : badgeCounts.solar} solar
            </Badge>
            {!isHero ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => {
                  setMapOpen((v) => !v);
                  if (mapOpen) setSelected(null);
                }}
                aria-expanded={mapOpen}
              >
                {mapOpen ? (
                  <>
                    <ChevronUp className="size-3.5" />
                    <span className="hidden sm:inline">Hide map</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" />
                    <span className="hidden sm:inline">Show map</span>
                  </>
                )}
              </Button>
            ) : null}
            {mapOpen ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => setExpanded(true)}
                aria-label="Open larger map"
              >
                <Maximize2 className="size-3.5" />
                <span className="hidden sm:inline">Larger</span>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {mapOpen ? (
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
            <SystemsMapCanvas
              mapRef={mapRef}
              points={points}
              loading={loading}
              heightClass={previewHeight}
              onReady={onMapReady}
              scopeLabel={scopeLabel}
              compact={compact && !isHero}
              lightBasemap={compact || isHero}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
            {selected ? (
              <SiteDetailPanel
                point={selected}
                waterCoverage={waterCoverage}
                solarCoverage={solarCoverage}
                onClose={() => setSelected(null)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Click a water or solar pin to inspect that site.
              </p>
            )}
            {pointsTruncated > 0 ? (
              <p className="text-xs text-amber-800">
                Showing {PAGE_SIZE.mapMarkers} of{" "}
                {PAGE_SIZE.mapMarkers + pointsTruncated} sites (GPS pins first).
                Narrow tehsil/village filters to plot the rest.
              </p>
            ) : null}
            {!mapBusy && badgeCounts.water + badgeCounts.solar === 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                No facilities in this area — change tehsil or village in the
                filters above.
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          className="flex h-[min(94vh,960px)] w-[min(98vw,1600px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none sm:p-5"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
            <DialogTitle>Facility map — larger view</DialogTitle>
            <DialogDescription>
              {scopeLabel
                ? `Showing ${scopeLabel}. Click a pin for site details.`
                : "Blue = water systems. Amber = solar systems."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_320px]">
            <div className="min-h-0 overflow-hidden rounded-lg border border-border/60">
              <SystemsMapCanvas
                mapRef={expandedMapRef}
                points={points}
                loading={loading}
                heightClass="h-full min-h-[min(78vh,780px)]"
                onReady={onExpandedMapReady}
                scopeLabel={scopeLabel}
                lightBasemap
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            </div>
            <div className="min-h-0 overflow-y-auto">
              {selected ? (
                <SiteDetailPanel
                  point={selected}
                  waterCoverage={waterCoverage}
                  solarCoverage={solarCoverage}
                  onClose={() => setSelected(null)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a facility on the map to see logging status, last log,
                  and assigned operators.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
