import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { WellsMap } from '../components/WellsMap'
import { useWells } from '../context/WellsContext'

export type HoverCoords = { lat: number; lon: number }

export function MapPage() {
  const { error, wells, loading, filters, mapPointLimit, eligibleCount } =
    useWells()
  const [hoverCoords, setHoverCoords] = useState<HoverCoords | null>(null)
  const hoverKeyRef = useRef('')

  const reportPointerLatLng = useCallback((lat: number, lon: number) => {
    const key = `${lat.toFixed(5)},${lon.toFixed(5)}`
    if (key === hoverKeyRef.current) return
    hoverKeyRef.current = key
    setHoverCoords({ lat, lon })
  }, [])

  useEffect(() => {
    return () => {
      hoverKeyRef.current = ''
      setHoverCoords(null)
    }
  }, [])

  const noFilters =
    filters.empresa.length === 0 &&
    filters.provincia.length === 0 &&
    filters.cuenca.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            Mapa de pozos
          </h1>
          <p
            className="shrink-0 font-mono text-sm font-semibold tabular-nums tracking-tight text-slate-200 sm:text-base"
            aria-live="polite">
            {hoverCoords ? (
              <>
                <span className="text-slate-200">Lat:</span>{' '}
                {hoverCoords.lat.toFixed(5)}
                <span className="mx-1.5 font-normal text-slate-500">|</span>
                <span className="text-slate-200">Lon:</span>{' '}
                {hoverCoords.lon.toFixed(5)}
              </>
            ) : (
              <span className="font-normal text-slate-500">
                Lat — <span className="text-slate-600">|</span> Lon —
              </span>
            )}
          </p>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {loading
            ? 'Sincronizando con la API…'
            : `${wells.length.toLocaleString('es-AR')} pozos en vista`}
        </p>
        {!loading && (
          <p className="mt-1 text-xs text-slate-500">
            Límite actual:{' '}
            <span className="font-mono text-slate-400">
              {mapPointLimit.toLocaleString('es-AR')}
            </span>{' '}
            pozos (de{' '}
            <span className="font-mono text-slate-400">
              {eligibleCount.toLocaleString('es-AR')}
            </span>{' '}
            elegibles
            {noFilters ? '; ajustá el slider en el panel lateral.' : '.'}
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">No se pudieron cargar los datos</p>
            <p className="text-amber-200/80">{error}</p>
            <p className="mt-1 text-xs text-amber-200/60">
              El front usa{' '}
              <code className="rounded bg-slate-800 px-1">http://localhost:8000</code>{' '}
              (mismo host que Vite). Revisá <strong>PyG Backend</strong> y{' '}
              <code className="rounded bg-slate-800 px-1">/docs</code>. Si abrís el
              sitio por IP, definí{' '}
              <code className="rounded bg-slate-800 px-1">VITE_API_BASE</code>.
            </p>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <WellsMap onPointerLatLng={reportPointerLatLng} />
      </div>
    </div>
  )
}
