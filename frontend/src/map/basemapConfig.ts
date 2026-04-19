/**
 * Capas base y overlay IGN compartidas entre mapa principal y mini mapa.
 * Opacidad del IGN en calle: atenúa líneas/rellenos del híbrido sin borrar toponimia.
 */

export const CARTO_VOYAGER_NOLABELS = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
} as const

export const IGN_HIBRIDO_LABELS = {
  url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_hibrido@EPSG%3A3857@png/{z}/{x}/{-y}.png',
  attribution:
    'Etiquetas &copy; <a href="http://www.ign.gob.ar/">IGN Argentina</a>',
} as const

/** Calles / referencia tipo Google (grises suaves, bordes discretos). */
export const ESRI_WORLD_STREET = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Calles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; TomTom, Garmin, USGS, NOAA, GeoBase',
} as const

export const ESRI_IMAGERY = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Imagen &copy; Esri &mdash; Maxar, Earthstar Geographics, GIS User Community',
} as const

/** Por encima de markerPane (600): toponimia sobre pozos. */
export const IGN_LABELS_PANE_Z = 620

/** Sobre calle: deja predominar la base Esri/Carto; el IGN aporta nombres oficiales. */
export const IGN_OVERLAY_OPACITY_CALLES = 0.88
