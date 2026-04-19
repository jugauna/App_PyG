import { Filter, Layers, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { emptyWellFilters, useWells } from '../context/WellsContext'
import type { WellFilters } from '../services/wellsApi'
import { WellSearch } from './WellSearch'

function MultiSelect({
  label,
  options,
  value,
  onChange,
  id,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  id: string
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt))
    else onChange([...value, opt])
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-400">
        {label}
      </label>
      <div
        id={id}
        className="max-h-36 overflow-y-auto rounded-lg border border-slate-600 bg-slate-900/80 p-1.5"
        role="listbox"
        aria-multiselectable
      >
        {options.length === 0 ? (
          <p className="px-2 py-1 text-xs text-slate-500">Sin datos</p>
        ) : (
          options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-slate-500 bg-slate-800 text-sky-500"
              />
              <span className="truncate" title={opt}>
                {opt}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

export function SidebarFilters({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const {
    filterOptions,
    filters,
    setFilters,
    loading,
    mapPointLimit,
    setMapPointLimit,
    eligibleCount,
  } = useWells()

  const [sliderVal, setSliderVal] = useState(mapPointLimit)

  useEffect(() => {
    setSliderVal(mapPointLimit)
  }, [mapPointLimit])

  useEffect(() => {
    if (sliderVal === mapPointLimit) return
    const id = window.setTimeout(() => {
      setMapPointLimit(sliderVal)
    }, 260)
    return () => window.clearTimeout(id)
  }, [sliderVal, mapPointLimit, setMapPointLimit])

  const patch = (partial: Partial<WellFilters>) => {
    setFilters({ ...filters, ...partial })
  }

  const clear = () => setFilters(emptyWellFilters)

  const maxSlider = Math.max(0, eligibleCount)
  const sliderStep =
    maxSlider > 4000
      ? Math.max(50, Math.round(maxSlider / 200))
      : maxSlider > 400
        ? 10
        : 1

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur transition-[width] duration-200 ease-out ${
        collapsed ? 'w-0 overflow-hidden border-r-0' : 'w-72 sm:w-80'
      }`}
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-700 px-3">
        {!collapsed && (
          <>
            <div className="flex items-center gap-2 text-slate-100">
              <Filter className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-semibold tracking-tight">
                Filtros
              </span>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Colapsar filtros"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-visible p-3">
          <WellSearch />
          <p className="text-xs leading-relaxed text-slate-500">
            Elegí una o más opciones. La petición a la API se actualiza al
            cambiar la selección.
          </p>

          <MultiSelect
            id="f-empresa"
            label="Empresa"
            options={filterOptions.empresas}
            value={filters.empresa}
            onChange={(empresa) => patch({ empresa })}
          />
          <MultiSelect
            id="f-provincia"
            label="Provincia"
            options={filterOptions.provincias}
            value={filters.provincia}
            onChange={(provincia) => patch({ provincia })}
          />
          <MultiSelect
            id="f-cuenca"
            label="Cuenca"
            options={filterOptions.cuencas}
            value={filters.cuenca}
            onChange={(cuenca) => patch({ cuenca })}
          />

          <div className="space-y-2 rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
            <div className="flex items-center gap-2 text-slate-300">
              <Layers className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="text-xs font-semibold tracking-tight">
                Máximo de pozos en el mapa
              </span>
            </div>
            <p className="text-[11px] leading-snug text-slate-500">
              Top por producción petróleo + gas. Rango según filtros:{' '}
              <span className="font-mono text-slate-400">
                0 – {maxSlider.toLocaleString('es-AR')}
              </span>
              .
            </p>
            <input
              type="range"
              min={0}
              max={maxSlider === 0 ? 0 : maxSlider}
              step={sliderStep}
              value={
                maxSlider === 0
                  ? 0
                  : Math.min(sliderVal, maxSlider)
              }
              disabled={maxSlider === 0 || loading}
              onChange={(e) =>
                setSliderVal(Number.parseInt(e.target.value, 10))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-valuemin={0}
              aria-valuemax={maxSlider}
              aria-valuenow={Math.min(sliderVal, maxSlider)}
              aria-label="Máximo de pozos en el mapa"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>0</span>
              <span className="font-mono text-sky-300/90">
                {Math.min(sliderVal, maxSlider).toLocaleString('es-AR')} /{' '}
                {maxSlider.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-slate-600 bg-slate-800/80 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            Limpiar filtros
          </button>

          {loading && (
            <p className="text-center text-xs text-sky-400/90">Cargando…</p>
          )}
        </div>
      )}
    </aside>
  )
}
