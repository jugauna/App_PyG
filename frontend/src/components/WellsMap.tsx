import { memo, useMemo } from 'react'
import {
  LayerGroup,
  LayersControl,
  MapContainer,
  Marker,
  Pane,
  ScaleControl,
  TileLayer,
  Tooltip,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'

import { useWells } from '../context/WellsContext'
import '../map/leafletIcon'
import { MapCrosshairCardinal } from './MapCrosshairCardinal'
import { MapPointerReporter } from './MapPointerReporter'
import {
  CARTO_VOYAGER_NOLABELS,
  ESRI_IMAGERY,
  ESRI_WORLD_STREET,
  IGN_HIBRIDO_LABELS,
  IGN_LABELS_PANE_Z,
  IGN_OVERLAY_OPACITY_CALLES,
} from '../map/basemapConfig'

const NEUQUINA_CENTER: [number, number] = [-38.45, -68.52]
const DEFAULT_ZOOM = 7

export type WellsMapProps = {
  /** Actualiza coordenadas bajo el cursor (cabecera MapPage); deduplicar en el padre. */
  onPointerLatLng?: (lat: number, lon: number) => void
}

/** Abre ficha en nueva pestaña con el mismo año que el mapa (`WellsContext`). */
function openWellDetailTab(sigla: string, anioContexto: number) {
  window.open(
    `${window.location.origin}/pozo/${encodeURIComponent(sigla)}?anio=${anioContexto}`,
    '_blank',
    'noopener,noreferrer',
  )
}

function IgnLabelsOverlay({ paneName }: { paneName: string }) {
  return (
    <Pane name={paneName} style={{ zIndex: IGN_LABELS_PANE_Z }}>
      <TileLayer
        attribution={IGN_HIBRIDO_LABELS.attribution}
        url={IGN_HIBRIDO_LABELS.url}
        tms
        maxZoom={20}
        opacity={IGN_OVERLAY_OPACITY_CALLES}
      />
    </Pane>
  )
}

function IgnLabelsOverlaySatellite({ paneName }: { paneName: string }) {
  return (
    <Pane name={paneName} style={{ zIndex: IGN_LABELS_PANE_Z }}>
      <TileLayer
        attribution={IGN_HIBRIDO_LABELS.attribution}
        url={IGN_HIBRIDO_LABELS.url}
        tms
        maxZoom={20}
        opacity={1}
      />
    </Pane>
  )
}

export const WellsMap = memo(function WellsMap({
  onPointerLatLng,
}: WellsMapProps) {
  const { wells, anio } = useWells()

  const points = useMemo(
    () =>
      wells.filter(
        (w) =>
          w.sigla &&
          w.latitud != null &&
          w.longitud != null &&
          !Number.isNaN(w.latitud) &&
          !Number.isNaN(w.longitud),
      ),
    [wells],
  )

  return (
    <MapContainer
      center={NEUQUINA_CENTER}
      zoom={DEFAULT_ZOOM}
      className="leaflet-main-map z-0 h-full min-h-[480px] w-full rounded-lg shadow-xl ring-1 ring-slate-300 [filter:none] [&_.leaflet-pane]:[filter:none] [&_img.leaflet-tile]:[filter:none]"
      scrollWheelZoom >
      <MapCrosshairCardinal />
      {onPointerLatLng ? (
        <MapPointerReporter onMove={onPointerLatLng} />
      ) : null}
      <ScaleControl
        position="bottomleft"
        metric
        imperial={false}
        maxWidth={200}
      />

      <LayersControl position="topright">
        <LayersControl.BaseLayer
          checked
          name="Calles (Esri, estilo Google) + etiquetas IGN">
          <LayerGroup>
            <TileLayer
              attribution={ESRI_WORLD_STREET.attribution}
              url={ESRI_WORLD_STREET.url}
              maxZoom={19}
            />
            <IgnLabelsOverlay paneName="pyg-ign-labels-esri" />
          </LayerGroup>
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Calles (Carto) + etiquetas IGN">
          <LayerGroup>
            <TileLayer
              attribution={CARTO_VOYAGER_NOLABELS.attribution}
              url={CARTO_VOYAGER_NOLABELS.url}
              subdomains="abcd"
              maxZoom={20}
            />
            <IgnLabelsOverlay paneName="pyg-ign-labels-carto" />
          </LayerGroup>
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satélite (ESRI) + etiquetas IGN">
          <LayerGroup>
            <TileLayer
              attribution={ESRI_IMAGERY.attribution}
              url={ESRI_IMAGERY.url}
              maxZoom={19}
            />
            <IgnLabelsOverlaySatellite paneName="pyg-ign-labels-sat" />
          </LayerGroup>
        </LayersControl.BaseLayer>
      </LayersControl>

      <MarkerClusterGroup chunkedLoading>
        {points.map((w) => (
          <Marker
            key={w.sigla}
            position={[w.latitud as number, w.longitud as number]}
            eventHandlers={{
              click: () => {
                if (w.sigla) openWellDetailTab(w.sigla, anio)
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -36]} opacity={0.95}>
              <div className="flex flex-col gap-1 text-slate-900">
                <span className="font-semibold">{w.sigla}</span>
                <button
                  type="button"
                  className="text-left text-xs font-medium text-sky-700 underline hover:text-sky-900"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (w.sigla) openWellDetailTab(w.sigla, anio)
                  }}
                >
                  Abrir ficha en nueva pestaña
                </button>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
})
