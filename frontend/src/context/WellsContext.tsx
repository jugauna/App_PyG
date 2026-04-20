import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  DEFAULT_API_YEAR,
  fetchFilterOptions,
  fetchMapWells,
  fetchMapWellsCount,
  formatWellsFetchError,
  type WellFilters,
} from '../services/wellsApi'
import type { WellMapPoint } from '../types/well'

/** Coincide con el default del backend. */
export const DEFAULT_MAP_WELLS_LIMIT = 5000

type WellsContextValue = {
  wells: WellMapPoint[]
  filterOptions: {
    empresas: string[]
    provincias: string[]
    cuencas: string[]
  }
  filters: WellFilters
  setFilters: (f: WellFilters) => void
  /** Año del dataset Parquet (2025 / 2026); todas las consultas al API lo incluyen. */
  anio: number
  setAnio: (y: number) => void
  mapPointLimit: number
  setMapPointLimit: (n: number) => void
  eligibleCount: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const WellsContext = createContext<WellsContextValue | null>(null)

export const emptyWellFilters: WellFilters = {
  empresa: [],
  provincia: [],
  cuenca: [],
}

export function WellsProvider({ children }: { children: ReactNode }) {
  const [wells, setWells] = useState<WellMapPoint[]>([])
  const [filterOptions, setFilterOptions] = useState({
    empresas: [] as string[],
    provincias: [] as string[],
    cuencas: [] as string[],
  })
  const [filters, setFilters] = useState<WellFilters>(emptyWellFilters)
  const [anio, setAnio] = useState(DEFAULT_API_YEAR)
  const [mapPointLimit, setMapPointLimit] = useState(DEFAULT_MAP_WELLS_LIMIT)
  const [eligibleCount, setEligibleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [opts, { count }] = await Promise.all([
          fetchFilterOptions(anio),
          fetchMapWellsCount(filters, anio),
        ])
        if (cancelled) return
        setFilterOptions({
          empresas: opts.empresas,
          provincias: opts.provincias,
          cuencas: opts.cuencas,
        })
        setEligibleCount(count)
        const fetchLimit = Math.max(0, Math.min(mapPointLimit, count))
        setMapPointLimit((p) => Math.min(p, count))
        const data = await fetchMapWells(filters, fetchLimit, anio)
        if (cancelled) return
        setWells(data)
      } catch (e) {
        if (!cancelled) {
          setError(formatWellsFetchError(e))
          setWells([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [anio, filters, mapPointLimit])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [opts, { count }] = await Promise.all([
        fetchFilterOptions(anio),
        fetchMapWellsCount(filters, anio),
      ])
      setFilterOptions({
        empresas: opts.empresas,
        provincias: opts.provincias,
        cuencas: opts.cuencas,
      })
      setEligibleCount(count)
      setMapPointLimit((p) => (p > count ? count : p))
      const lim = Math.min(mapPointLimit, count)
      const data = await fetchMapWells(filters, lim, anio)
      setWells(data)
    } catch (e) {
      setError(formatWellsFetchError(e))
    } finally {
      setLoading(false)
    }
  }, [filters, mapPointLimit, anio])

  const value = useMemo(
    () => ({
      wells,
      filterOptions,
      filters,
      setFilters,
      anio,
      setAnio,
      mapPointLimit,
      setMapPointLimit,
      eligibleCount,
      loading,
      error,
      refresh,
    }),
    [
      wells,
      filterOptions,
      filters,
      anio,
      mapPointLimit,
      eligibleCount,
      loading,
      error,
      refresh,
    ],
  )

  return <WellsContext.Provider value={value}>{children}</WellsContext.Provider>
}

export function useWells(): WellsContextValue {
  const ctx = useContext(WellsContext)
  if (!ctx) throw new Error('useWells debe usarse dentro de WellsProvider')
  return ctx
}
