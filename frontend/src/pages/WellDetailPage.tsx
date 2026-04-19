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
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { WellMiniMap } from '../components/well-detail/WellMiniMap'
import { WellProductionChart } from '../components/well-detail/WellProductionChart'
import {
  downloadWellCsv,
  fmtDisplayDate,
  statusBadge,
  toNum,
  waterCutPct,
} from '../components/well-detail/wellDetailUtils'
import { fetchWellDetail, formatWellsFetchError } from '../services/wellsApi'
import type { Well } from '../types/well'

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

export function WellDetailPage() {
  const { sigla: siglaParam } = useParams<{ sigla: string }>()
  const sigla = siglaParam ? decodeURIComponent(siglaParam) : ''
  const [well, setWell] = useState<Well | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!sigla) {
      setWell(null)
      setLoading(false)
      setErr(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchWellDetail(sigla)
        if (!cancelled) setWell(data)
      } catch (e) {
        if (!cancelled) {
          setWell(null)
          setErr(formatWellsFetchError(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sigla])

  const badge = useMemo(
    () => statusBadge(well?.tipoestado ?? null),
    [well?.tipoestado],
  )

  const pet = toNum(well?.prod_pet)
  const gas = toNum(well?.prod_gas)
  const agua = toNum(well?.prod_agua)
  const prof = toNum(well?.profundidad_medida)
  const wc = waterCutPct(pet, agua)
  const lat = toNum(well?.latitud)
  const lon = toNum(well?.longitud)

  const wellRecord = useMemo(
    () => (well ? ({ ...well } as Record<string, unknown>) : null),
    [well],
  )

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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
          <p className="text-sm text-slate-400">Cargando dashboard…</p>
        </div>
      </div>
    )
  }

  if (err || !well) {
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

  const chartPet = pet ?? 0
  const chartGas = gas ?? 0

  return (
    <div className="min-h-full bg-slate-950 pb-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-[#3b82f6] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al mapa
          </Link>
          <button
            type="button"
            onClick={() => wellRecord && downloadWellCsv(wellRecord, sigla)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 shadow-sm transition hover:border-[#3b82f6]/50 hover:bg-slate-800"
          >
            <Download className="h-4 w-4 text-[#3b82f6]" />
            Descargar ficha (CSV)
          </button>
        </div>

        {/* Header ejecutivo */}
        <header className="grid gap-4 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-xl ring-1 ring-slate-800/80 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-white md:text-3xl">
                {well.sigla}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
                <Factory className="mt-0.5 h-5 w-5 shrink-0 text-[#3b82f6]" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Operadora
                  </p>
                  <p className="text-sm font-medium text-slate-100">
                    {well.empresa ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Yacimiento
                  </p>
                  <p className="text-sm font-medium text-slate-100">
                    {well.yacimiento ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 sm:col-span-2 lg:col-span-1">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Ubicación
                  </p>
                  <p className="font-mono text-sm text-slate-200">
                    {lat != null && lon != null
                      ? `${fmtNum(lat, 5)}, ${fmtNum(lon, 5)}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg ring-1 ring-slate-800/50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Acumulado petróleo
              </p>
              <Fuel className="h-5 w-5 text-[#3b82f6]" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {fmtNum(pet)}
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
              {fmtNum(gas)}
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
              {wc != null ? `${fmtNum(wc, 1)} %` : '—'}
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
              {fmtNum(prof, 1)}
            </p>
            <p className="mt-1 text-xs text-slate-500">m (MD)</p>
          </div>
        </section>

        {/* Gráfico principal */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-xl ring-1 ring-slate-800/80">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Producción declarada
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Doble eje: petróleo (barras) y gas (línea). Colores corporativos
            petróleo / gas.
          </p>
          <WellProductionChart petroleo={chartPet} gas={chartGas} />
        </section>

        {/* Metadatos + mini mapa */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg ring-1 ring-slate-800/80">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Metadatos técnicos
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-800">
                  <tr className="bg-slate-900/50">
                    <th className="w-2/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cuenca
                    </th>
                    <td className="px-4 py-3 text-slate-200">
                      {well.cuenca ?? '—'}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Provincia
                    </th>
                    <td className="px-4 py-3 text-slate-200">
                      {well.provincia ?? '—'}
                    </td>
                  </tr>
                  <tr className="bg-slate-900/50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tipo de recurso
                    </th>
                    <td className="px-4 py-3 text-slate-200">
                      {well.tipo_de_recurso ?? '—'}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Clasificación
                    </th>
                    <td className="px-4 py-3 text-slate-200">
                      {recursoConvencionalLabel(well.tipo_de_recurso)}
                    </td>
                  </tr>
                  <tr className="bg-slate-900/50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tipo de reservorio / extracción
                    </th>
                    <td className="px-4 py-3 text-slate-200">
                      {well.tipoextraccion?.trim() ? well.tipoextraccion : '—'}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Inicio producción / perforación
                    </th>
                    <td className="px-4 py-3 font-mono text-slate-200">
                      {fmtDisplayDate(well.fecha_inicio_perf)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
              La fecha proviene del campo{' '}
              <span className="font-mono text-slate-500">fecha_inicio_perf</span>{' '}
              del maestro (inicio de perforación en fuente capítulo IV).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg ring-1 ring-slate-800/80">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Mapa de contexto
            </h2>
            {lat != null && lon != null ? (
              <WellMiniMap lat={lat} lon={lon} label={well.sigla} />
            ) : (
              <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-sm text-slate-500">
                Sin coordenadas para este pozo.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
