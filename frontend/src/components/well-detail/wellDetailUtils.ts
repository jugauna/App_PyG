/** Utilidades para ficha de pozo (KPIs, export, estado). */

import type { WellMonthlyRecord } from '../../types/well'

export function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isNaN(n) ? null : n
  }
  return null
}

/** Etiquetas cortas para eje X (orden calendario 1–12). */
export const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

/** Corte de agua en líquido: agua / (petróleo + agua) × 100 */
export function waterCutPct(
  prodPet: number | null,
  prodAgua: number | null,
): number | null {
  const p = prodPet ?? 0
  const w = prodAgua ?? 0
  const liq = p + w
  if (liq <= 0) return null
  return Math.min(100, Math.max(0, (w / liq) * 100))
}

export function statusBadge(tipoestado: string | null | undefined): {
  label: string
  className: string
} {
  const s = (tipoestado ?? 'Sin dato').trim() || 'Sin dato'
  const lower = s.toLowerCase()
  let cls =
    'border border-slate-600 bg-slate-800/90 text-slate-200 shadow-sm'
  if (
    lower.includes('product') ||
    lower.includes('act') ||
    lower.includes('inyect')
  ) {
    cls =
      'border border-emerald-600/60 bg-emerald-950/70 text-emerald-200 shadow-sm'
  } else if (
    lower.includes('inact') ||
    lower.includes('cerr') ||
    lower.includes('suspend')
  ) {
    cls =
      'border border-amber-700/50 bg-amber-950/50 text-amber-100 shadow-sm'
  } else if (
    lower.includes('aband') ||
    lower.includes('tap') ||
    lower.includes('plug')
  ) {
    cls = 'border border-red-800/50 bg-red-950/40 text-red-200 shadow-sm'
  }
  return { label: s, className: cls }
}

export function fmtDisplayDate(v: unknown): string {
  if (v == null || v === '') return '—'
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

export type MonthlyProductionRow = {
  periodo: string
  petroleo: number
  gas: number
}

export function totalsFromWellRows(rows: WellMonthlyRecord[]): {
  pet: number
  gas: number
  agua: number
} {
  let pet = 0
  let gas = 0
  let agua = 0
  for (const r of rows) {
    pet += toNum(r.prod_pet) ?? 0
    gas += toNum(r.prod_gas) ?? 0
    agua += toNum(r.prod_agua) ?? 0
  }
  return { pet, gas, agua }
}

/** Serie mensual real ordenada por `mes` (solo meses presentes en el dataset). */
export function chartDataFromWellRows(
  rows: WellMonthlyRecord[],
): MonthlyProductionRow[] {
  const sorted = [...rows].sort(
    (a, b) => (toNum(a.mes) ?? 0) - (toNum(b.mes) ?? 0),
  )
  const out: MonthlyProductionRow[] = []
  for (const r of sorted) {
    const m = toNum(r.mes)
    if (m == null || m < 1 || m > 12) continue
    out.push({
      periodo: MONTH_SHORT_ES[m - 1],
      petroleo: toNum(r.prod_pet) ?? 0,
      gas: toNum(r.prod_gas) ?? 0,
    })
  }
  return out
}

/** Fila representativa (último mes con dato) para metadatos de cabecera / tabla. */
export function latestWellRow(
  rows: WellMonthlyRecord[],
): WellMonthlyRecord | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort(
    (a, b) => (toNum(a.mes) ?? 0) - (toNum(b.mes) ?? 0),
  )
  return sorted[sorted.length - 1]
}

export function downloadWellCsv(
  rows: WellMonthlyRecord[],
  filenameSigla: string,
): void {
  if (rows.length === 0) return
  const latest = latestWellRow(rows)
  if (!latest) return

  const chart = chartDataFromWellRows(rows)
  const { pet, gas, agua } = totalsFromWellRows(rows)

  const rep: Record<string, unknown> = { ...latest }
  rep.prod_pet_anual_acumulado = pet
  rep.prod_gas_anual_acumulado = gas
  rep.prod_agua_anual_acumulado = agua

  for (const m of chart) {
    rep[`petroleo_mes_${m.periodo}`] = m.petroleo
    rep[`gas_mes_${m.periodo}`] = m.gas
  }

  const entries = Object.entries(rep).filter(([, v]) => v !== undefined)
  const esc = (val: unknown) => {
    const str = val == null ? '' : String(val)
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const header = entries.map(([k]) => k).join(',')
  const row = entries.map(([, v]) => esc(v)).join(',')
  const bom = '\uFEFF'
  const blob = new Blob([bom + header + '\n' + row], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ficha_${filenameSigla.replace(/[^\w.-]+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
