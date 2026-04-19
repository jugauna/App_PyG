/** Utilidades para ficha de pozo (KPIs, export, estado). */

export function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isNaN(n) ? null : n
  }
  return null
}

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

/** Misma configuración en gráfico (WellProductionChart) y export CSV. */
export const CHART_SYNTHETIC_MONTHS = 12
export const CHART_SYNTHETIC_DECLINE_FRAC = 0.05

/**
 * Reparte el volumen declarado en 12 meses con declinación geométrica mensual
 * (cada mes = (1 - decline) × el anterior). La suma mensual coincide con el total.
 */
export function syntheticMonthlyProduction(
  totalPet: number,
  totalGas: number,
  months = CHART_SYNTHETIC_MONTHS,
  monthlyDeclineFrac = CHART_SYNTHETIC_DECLINE_FRAC,
): MonthlyProductionRow[] {
  const r = 1 - monthlyDeclineFrac
  const denom = (1 - Math.pow(r, months)) / (1 - r)
  const q0Pet =
    totalPet > 0 && denom > 0 && Number.isFinite(denom) ? totalPet / denom : 0
  const q0Gas =
    totalGas > 0 && denom > 0 && Number.isFinite(denom) ? totalGas / denom : 0
  return Array.from({ length: months }, (_, t) => ({
    periodo: `Mes ${t + 1}`,
    petroleo: q0Pet * Math.pow(r, t),
    gas: q0Gas * Math.pow(r, t),
  }))
}

function csvNumericCell(n: number): string {
  if (!Number.isFinite(n)) return ''
  return String(n)
}

export function downloadWellCsv(
  well: Record<string, unknown>,
  filenameSigla: string,
): void {
  const entries = Object.entries(well).filter(([, v]) => v !== undefined)
  const esc = (val: unknown) => {
    const str = val == null ? '' : String(val)
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const totalPet = toNum(well.prod_pet) ?? 0
  const totalGas = toNum(well.prod_gas) ?? 0
  const monthly = syntheticMonthlyProduction(
    totalPet,
    totalGas,
    CHART_SYNTHETIC_MONTHS,
    CHART_SYNTHETIC_DECLINE_FRAC,
  )

  const monthCols: [string, string][] = []
  for (let i = 0; i < monthly.length; i++) {
    monthCols.push([`petroleo_mes_${i + 1}`, csvNumericCell(monthly[i].petroleo)])
  }
  for (let i = 0; i < monthly.length; i++) {
    monthCols.push([`gas_mes_${i + 1}`, csvNumericCell(monthly[i].gas)])
  }

  const masterHeader = entries.map(([k]) => k)
  const masterRow = entries.map(([, v]) => esc(v))
  const extraHeader = monthCols.map(([k]) => k)
  const extraRow = monthCols.map(([, v]) => esc(v))

  const header = [...masterHeader, ...extraHeader].join(',')
  const row = [...masterRow, ...extraRow].join(',')
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
