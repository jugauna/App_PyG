import { useMemo } from 'react'
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

import {
  CHART_SYNTHETIC_DECLINE_FRAC,
  CHART_SYNTHETIC_MONTHS,
  syntheticMonthlyProduction,
} from './wellDetailUtils'

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
      <p className="mb-2 border-b border-slate-700 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
  petroleo: number
  gas: number
}

export function WellProductionChart({ petroleo, gas }: Props) {
  const data = useMemo(
    () =>
      syntheticMonthlyProduction(
        petroleo,
        gas,
        CHART_SYNTHETIC_MONTHS,
        CHART_SYNTHETIC_DECLINE_FRAC,
      ),
    [petroleo, gas],
  )

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 20, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
          <XAxis
            dataKey="periodo"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#475569' }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={56}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: OIL, fontSize: 11 }}
            axisLine={{ stroke: OIL, opacity: 0.5 }}
            label={{
              value: 'Petróleo (m³)',
              angle: -90,
              position: 'insideLeft',
              fill: OIL,
              fontSize: 11,
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: GAS, fontSize: 11 }}
            axisLine={{ stroke: GAS, opacity: 0.5 }}
            label={{
              value: 'Gas (dam³)',
              angle: 90,
              position: 'insideRight',
              fill: GAS,
              fontSize: 11,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
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
            maxBarSize={28}
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
      <p className="mt-2 text-center text-xs text-slate-500">
        Serie mensual <strong className="text-slate-400">ilustrativa</strong>: el
        maestro tiene un único período por pozo; se distribuye el volumen
        declarado en 12 meses con declinación del 5% para visualización tipo
        panel profesional.
      </p>
    </div>
  )
}
