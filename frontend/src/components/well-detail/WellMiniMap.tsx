import L from 'leaflet'
import { MapContainer, Marker, Pane, ScaleControl, TileLayer } from 'react-leaflet'

import '../../map/leafletIcon'
import {
  ESRI_WORLD_STREET,
  IGN_HIBRIDO_LABELS,
  IGN_LABELS_PANE_Z,
  IGN_OVERLAY_OPACITY_CALLES,
} from '../../map/basemapConfig'

const MARKER_BLUE = '#3b82f6'

/** Marcador explícito (no depende del default global) para resaltar sobre fondo claro. */
const wellContextIcon = L.divIcon({
  className: 'well-mini-map-marker',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:${MARKER_BLUE};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

type Props = {
  lat: number
  lon: number
  label?: string | null
}

export function WellMiniMap({ lat, lon, label }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-200/90 shadow-inner ring-1 ring-slate-800">
      <MapContainer
        center={[lat, lon]}
        zoom={14}
        className="leaflet-well-context z-0 h-60 w-full [filter:none] [&_.leaflet-pane]:[filter:none] [&_img.leaflet-tile]:[filter:none]"
        scrollWheelZoom={false}
        dragging
        doubleClickZoom={false} >
        <ScaleControl
          position="bottomleft"
          metric
          imperial={false}
          maxWidth={200}
        />
        <TileLayer
          attribution={ESRI_WORLD_STREET.attribution}
          url={ESRI_WORLD_STREET.url}
          maxZoom={19}
        />
        <Pane name="pyg-ign-labels-mini" style={{ zIndex: IGN_LABELS_PANE_Z }}>
          <TileLayer
            attribution={IGN_HIBRIDO_LABELS.attribution}
            url={IGN_HIBRIDO_LABELS.url}
            tms
            maxZoom={20}
            opacity={IGN_OVERLAY_OPACITY_CALLES}
          />
        </Pane>
        <Marker
          position={[lat, lon]}
          title={label ?? undefined}
          icon={wellContextIcon}
        />
      </MapContainer>
      <p className="border-t border-slate-300 bg-slate-900/90 px-3 py-2 text-center text-[11px] text-slate-500">
        Contexto geográfico · {lat.toFixed(5)}, {lon.toFixed(5)}
      </p>
    </div>
  )
}
