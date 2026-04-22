import {
  ArrowLeft,
  Download,
  Droplets,
  Factory,
  Flame,
  Fuel,
  MapPin,
  MoveVertical,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { WellMiniMap } from '../components/well-detail/WellMiniMap'
import { WellProductionChart } from '../components/well-detail/WellProductionChart'
import {
  chartDataFromWellRows,
  downloadWellCsv,
  fmtDisplayDate,
  latestWellRow,
  statusBadge,
  toNum,
  totalsFromWellRows,
  waterCutPct,
} from '../components/well-detail/wellDetailUtils'
import {
  DEFAULT_API_YEAR,
  fetchWellDetail,
  formatWellsFetchError,
} from '../services/wellsApi'
import type { WellMonthlyRecord } from '../types/well'

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function recursoConvencionalLabel(tipo: string | null | undefined): string {
  if (!tipo?.trim()) return '—'
  const t = tipo.toLowerCase()
  if (
    t.includes('no conv') ||
    t.includes('shale') ||
    t.includes('lutita') ||
    t.includes('unconv')
  ) {
    return 'No convencional'
  }
  if (t.includes('conv')) return 'Convencional'
  return tipo.trim()
}

/** `anio` deriva exclusivamente de la query `?anio=` (fuente de verdad en URL). */
function parseAnioParam(raw: string | null): number {
  if (!raw) return DEFAULT_API_YEAR
  const n = Number.parseInt(raw, 10)
  if (n === 2025 || n === 2026) return n
  return DEFAULT_API_YEAR
}

const DETAIL_YEAR_OPTIONS = [2025, 2026] as const

export function WellDetailPage() {
  const { sigla: siglaParam } = useParams<{ sigla: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const anio = parseAnioParam(searchParams.get('anio'))
  const sigla = siglaParam ? decodeURIComponent(siglaParam) : ''

  const setAnioInUrl = (next: number) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('anio', String(next))
        return p
      },
      { replace: true },
    )
  }

  const [rows, setRows] = useState<WellMonthlyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  /** Tras la primera carga exitosa por pozo: permite distinguir cambio de año (sin pantalla inicial completa). */
  const [detailHydrated, setDetailHydrated] = useState(false)
  const loadedForSiglaRef = useRef<string | null>(null)

  useEffect(() => {
    if (!sigla) {
      loadedForSiglaRef.current = null
      setRows([])
      setDetailHydrated(false)
      setLoading(false)
      setErr(null)
      return
    }

    if (loadedForSiglaRef.current !== sigla) {
      loadedForSiglaRef.current = sigla
      setDetailHydrated(false)
    }

    // Limpieza inmediata: evita mostrar producción del año anterior mientras llega el nuevo dataset.
    setRows([])
    setErr(null)
    setLoading(true)

    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchWellDetail(sigla, anio)
        if (!cancelled) {
          setRows(data)
          setDetailHydrated(true)
        }
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setErr(formatWellsFetchError(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sigla, anio])

  const chartSeries = useMemo(() => chartDataFromWellRows(rows), [rows])
  const annual = useMemo(() => totalsFromWellRows(rows), [rows])

  if (!sigla) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
        <p className="text-slate-400">Sigla no válida.</p>
        <Link to="/" className="mt-4 inline-block text-sky-400 hover:underline">
          Volver al mapa
        </Link>
      </div>
    )
  }

  if (loading && rows.length === 0 && !detailHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
          <p className="text-sm text-slate-400">Cargando dashboard…</p>
        </div>
      </div>
    )
  }

  if (!loading && (err || rows.length === 0)) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
        <p className="text-lg text-slate-300">
          No se encontró el pozo{' '}
          <span className="font-mono text-white">{sigla}</span>.
        </p>
        {err && <p className="mt-2 text-sm text-amber-200/90">{err}</p>}
        <p className="mt-2 text-sm text-slate-500">
          Puede no estar en el dataset actual o la sigla en la URL no coincide.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sky-400 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al mapa
        </Link>
      </div>
    )
  }

  const yearRefreshInFlight =
    loading && rows.length === 0 && detailHydrated && !err

  const w = rows.length > 0 ? latestWellRow(rows) : null
  if (!yearRefreshInFlight && !w) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
        <p className="text-lg text-slate-300">
          No se encontró el pozo{' '}
          <span className="font-mono text-white">{sigla}</span>.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sky-400 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al mapa
        </Link>
      </div>
    )
  }

  const badge = statusBadge(w?.tipoestado ?? null)
  const pet = annual.pet
  const gas = annual.gas
  const agua = annual.agua
  const prof = toNum(w?.profundidad_medida)
  const wc = waterCutPct(pet, agua)
  const lat = toNum(w?.latitud)
  const lon = toNum(w?.longitud)

  return (
    <div
      key={`${sigla}-${anio}`}
      className="min-h-full w-full max-w-none bg-slate-950 pb-8 text-slate-100"
    >
      <div className="w-full max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-6">
        {/* Barra superior: navegación y controles */}
        <header className="sticky top-0 z-20 -mx-4 border-b border-slate-800/90 bg-slate-950/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-6 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#3b82f6] hover:underline sm:gap-2 sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Volver</span>
              <span className="hidden sm:inline">Volver al mapa</span>
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <label
                  htmlFor="detail-anio"
                  className="hidden text-sm font-medium text-slate-400 sm:inline"
                >
                  Año
                </label>
                <select
                  id="detail-anio"
                  value={anio}
                  disabled={loading}
                  onChange={(e) =>
                    setAnioInUrl(Number.parseInt(e.target.value, 10))
                  }
                  className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-100 focus:border-sky-500/80 focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm"
                  aria-label="Año de datos del pozo (sincronizado con la URL)"
                >
                  {DETAIL_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={yearRefreshInFlight || loading || rows.length === 0}
                onClick={() => downloadWellCsv(rows, sigla)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-xs font-medium text-slate-200 shadow-sm transition hover:border-[#3b82f6]/50 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:rounded-lg sm:px-4 sm:py-2 sm:text-sm"
              >
                <Download className="h-3.5 w-3.5 shrink-0 text-[#3b82f6] sm:h-4 sm:w-4" />
                <span className="sm:hidden">CSV</span>
                <span className="hidden sm:inline">Descargar ficha (CSV)</span>
              </button>
            </div>
          </div>
        </header>

        {/* Título y contexto */}
        <div className="space-y-2 border-b border-slate-800/80 pb-4">
          <div className="flex flex-wrap items-end gap-2 gap-y-2 sm:gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-white">
              {yearRefreshInFlight ? sigla : (w?.sigla ?? sigla)}
              <span className="ml-1.5 inline-block text-base font-semibold tabular-nums text-sky-300 sm:ml-2 lg:text-lg">
                ({anio})
              </span>
            </h1>
            {!yearRefreshInFlight ? (
              <span
                className={`mb-1 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm ${badge.className}`}
              >
                {badge.label}
              </span>
            ) : (
              <span className="mb-1 inline-flex items-center rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:text-sm">
                …
              </span>
            )}
          </div>
          <p className="max-w-3xl text-xs text-slate-500 sm:text-sm">
            Producción y metadatos correspondientes al año{' '}
            <span className="font-mono text-slate-400">{anio}</span> (parámetro
            de URL <span className="font-mono">?anio=</span>).
          </p>
        </div>

        {/* Bloque metadatos rápidos */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 shadow-xl ring-1 ring-slate-800/80 sm:p-5">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3">
              <div className="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2 sm:gap-3 sm:p-3">
                <Factory className="mt-0.5 h-5 w-5 shrink-0 text-[#3b82f6]" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Operadora
                  </p>
                  <p className="text-sm font-medium text-slate-100">
                    {yearRefreshInFlight ? '—' : (w?.empresa ?? '—')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2 sm:gap-3 sm:p-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Yacimiento
                  </p>
                  <p className="text-sm font-medium text-slate-100">
                    {yearRefreshInFlight ? '—' : (w?.yacimiento ?? '—')}
                  </p>
                </div>
              </div>
              <div className="col-span-2 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2 sm:gap-3 sm:p-3 lg:col-span-1">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Ubicación
                  </p>
                  <p className="font-mono text-sm text-slate-200">
                    {yearRefreshInFlight ? (
                      '—'
                    ) : lat != null && lon != null ? (
                      `${fmtNum(lat, 5)}, ${fmtNum(lon, 5)}`
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg ring-1 ring-slate-800/50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Acumulado petróleo
              </p>
              <Fuel className="h-5 w-5 text-[#3b82f6]" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {yearRefreshInFlight ? '—' : fmtNum(pet)}
            </p>
            <p className="mt-1 text-xs text-slate-500">m³ (reporte)</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg ring-1 ring-slate-800/50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Acumulado gas
              </p>
              <Flame className="h-5 w-5 text-[#10b981]" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {yearRefreshInFlight ? '—' : fmtNum(gas)}
            </p>
            <p className="mt-1 text-xs text-slate-500">dam³ (10³ m³)</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg ring-1 ring-slate-800/50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Corte de agua
              </p>
              <Droplets className="h-5 w-5 text-sky-300" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {yearRefreshInFlight
                ? '—'
                : wc != null
                  ? `${fmtNum(wc, 1)} %`
                  : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              agua / (petróleo + agua)
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg ring-1 ring-slate-800/50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Profundidad total
              </p>
              <MoveVertical className="h-5 w-5 text-amber-400" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {yearRefreshInFlight ? '—' : fmtNum(prof, 1)}
            </p>
            <p className="mt-1 text-xs text-slate-500">m (MD)</p>
          </div>
        </section>

        {/* Metadatos técnicos compactos */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-lg ring-1 ring-slate-800/80 sm:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:text-sm">
            Metadatos técnicos
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Provincia</p>
              <p className="truncate text-sm text-slate-200">
                {yearRefreshInFlight ? '—' : (w?.provincia ?? '—')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Cuenca</p>
              <p className="truncate text-sm text-slate-200">
                {yearRefreshInFlight ? '—' : (w?.cuenca ?? '—')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Recurso</p>
              <p className="truncate text-sm text-slate-200">
                {yearRefreshInFlight ? '—' : (w?.tipo_de_recurso ?? '—')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Clasificación</p>
              <p className="truncate text-sm text-slate-200">
                {yearRefreshInFlight ? '—' : recursoConvencionalLabel(w?.tipo_de_recurso)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Extracción</p>
              <p className="truncate text-sm text-slate-200">
                {yearRefreshInFlight
                  ? '—'
                  : w?.tipoextraccion?.trim()
                    ? w.tipoextraccion
                    : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Inicio perf.</p>
              <p className="truncate font-mono text-sm text-slate-200">
                {yearRefreshInFlight ? '—' : fmtDisplayDate(w?.fecha_inicio_perf)}
              </p>
            </div>
          </div>
        </section>

        {/* Gráfico principal */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-xl ring-1 ring-slate-800/80 sm:p-5">
          <h2 className="mb-0.5 text-sm font-semibold uppercase tracking-wide text-slate-400 sm:text-base">
            Producción declarada ({anio})
          </h2>
          <p className="mb-3 text-xs text-slate-500 sm:mb-4 sm:text-sm">
            Doble eje: petróleo (barras) y gas (línea). Colores corporativos
            petróleo / gas.
          </p>
          <div className="relative min-h-[280px] w-full sm:min-h-[400px]">
            {yearRefreshInFlight ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/85 px-4 py-8 text-center backdrop-blur-sm"
                role="status"
                aria-live="polite"
              >
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                <p className="text-sm font-medium text-sky-100">
                  Actualizando datos de producción para{' '}
                  <strong className="tabular-nums">{anio}</strong>…
                </p>
              </div>
            ) : null}
            <div
              className={
                yearRefreshInFlight ? 'pointer-events-none opacity-30' : ''
              }
            >
              <WellProductionChart data={chartSeries} />
            </div>
          </div>
        </section>

        {/* Mapa de contexto */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg ring-1 ring-slate-800/80">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Mapa de contexto
          </h2>
          {yearRefreshInFlight ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-sm text-slate-500">
              —
            </div>
          ) : lat != null && lon != null ? (
            <WellMiniMap lat={lat} lon={lon} label={w?.sigla ?? sigla} />
          ) : (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-sm text-slate-500">
              Sin coordenadas para este pozo.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
