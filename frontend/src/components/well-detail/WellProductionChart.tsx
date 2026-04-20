import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { useEffect, useState } from 'react'

import type { MonthlyProductionRow } from './wellDetailUtils'

const AXIS_FONT = 12

function useCompactChartHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 400,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const apply = () => setHeight(mq.matches ? 300 : 400)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return height
}

const OIL = '#3b82f6'
const GAS = '#10b981'

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const pet = payload.find((p) => p.dataKey === 'petroleo')
  const gas = payload.find((p) => p.dataKey === 'gas')
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 border-b border-slate-700 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="space-y-1.5 text-sm">
        {pet != null && (
          <p className="flex items-center justify-between gap-6">
            <span style={{ color: OIL }}>Petróleo (m³)</span>
            <span className="font-mono text-slate-100 tabular-nums">
              {Number(pet.value).toLocaleString('es-AR', {
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        )}
        {gas != null && (
          <p className="flex items-center justify-between gap-6">
            <span style={{ color: GAS }}>Gas (dam³)</span>
            <span className="font-mono text-slate-100 tabular-nums">
              {Number(gas.value).toLocaleString('es-AR', {
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

type Props = {
  data: MonthlyProductionRow[]
}

export function WellProductionChart({ data }: Props) {
  const chartHeight = useCompactChartHeight()

  if (data.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-2 text-center text-sm text-slate-500 sm:min-h-[280px]">
        No hay serie mensual en el dataset para este pozo y año.
      </div>
    )
  }

  const manyMonths = data.length > 6
  const xAxisHeight = manyMonths ? 58 : 36

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 22, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
          <XAxis
            dataKey="periodo"
            tick={{ fill: '#94a3b8', fontSize: AXIS_FONT }}
            axisLine={{ stroke: '#475569' }}
            interval={0}
            angle={manyMonths ? -28 : 0}
            textAnchor={manyMonths ? 'end' : 'middle'}
            height={xAxisHeight}
            tickMargin={manyMonths ? 8 : 6}
          />
          <YAxis
            yAxisId="left"
            width={48}
            tick={{ fill: OIL, fontSize: AXIS_FONT }}
            axisLine={{ stroke: OIL, opacity: 0.5 }}
            tickFormatter={(v) =>
              typeof v === 'number'
                ? v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                : String(v)
            }
            label={{
              value: 'Petróleo (m³)',
              angle: -90,
              position: 'insideLeft',
              fill: OIL,
              fontSize: AXIS_FONT,
              offset: 2,
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            width={48}
            tick={{ fill: GAS, fontSize: AXIS_FONT }}
            axisLine={{ stroke: GAS, opacity: 0.5 }}
            tickFormatter={(v) =>
              typeof v === 'number'
                ? v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                : String(v)
            }
            label={{
              value: 'Gas (dam³)',
              angle: 90,
              position: 'insideRight',
              fill: GAS,
              fontSize: AXIS_FONT,
              offset: 2,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 12 }}
            formatter={(value) => (
              <span className="text-sm text-slate-300">{value}</span>
            )}
          />
          <Bar
            yAxisId="left"
            dataKey="petroleo"
            name="Petróleo (m³)"
            fill={OIL}
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="gas"
            name="Gas (dam³)"
            stroke={GAS}
            strokeWidth={2.5}
            dot={{ r: 4, fill: GAS, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-slate-500 sm:text-sm">
        Producción mensual declarada en fuentes oficiales (solo meses con registro
        en el Parquet del año seleccionado).
      </p>
    </div>
  )
}
