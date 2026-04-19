import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
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
  const [mapPointLimit, setMapPointLimit] = useState(DEFAULT_MAP_WELLS_LIMIT)
  const [eligibleCount, setEligibleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapDone, setBootstrapDone] = useState(false)
  const skipDuplicateFetchAfterBootstrap = useRef(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [opts, { count }] = await Promise.all([
          fetchFilterOptions(),
          fetchMapWellsCount(emptyWellFilters),
        ])
        if (cancelled) return
        setFilterOptions({
          empresas: opts.empresas,
          provincias: opts.provincias,
          cuencas: opts.cuencas,
        })
        setEligibleCount(count)
        const initialLimit = Math.min(DEFAULT_MAP_WELLS_LIMIT, count)
        setMapPointLimit(initialLimit)
        const data = await fetchMapWells(emptyWellFilters, initialLimit)
        if (cancelled) return
        setWells(data)
        setBootstrapDone(true)
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
  }, [])

  useEffect(() => {
    if (!bootstrapDone) return
    if (skipDuplicateFetchAfterBootstrap.current) {
      skipDuplicateFetchAfterBootstrap.current = false
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { count } = await fetchMapWellsCount(filters)
        if (cancelled) return
        setEligibleCount(count)
        const capped = Math.min(mapPointLimit, count)
        setMapPointLimit((p) => (p > count ? count : p))
        const data = await fetchMapWells(filters, capped)
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
  }, [filters, mapPointLimit, bootstrapDone])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [opts, { count }] = await Promise.all([
        fetchFilterOptions(),
        fetchMapWellsCount(filters),
      ])
      setFilterOptions({
        empresas: opts.empresas,
        provincias: opts.provincias,
        cuencas: opts.cuencas,
      })
      setEligibleCount(count)
      setMapPointLimit((p) => (p > count ? count : p))
      const lim = Math.min(mapPointLimit, count)
      const data = await fetchMapWells(filters, lim)
      setWells(data)
    } catch (e) {
      setError(formatWellsFetchError(e))
    } finally {
      setLoading(false)
    }
  }, [filters, mapPointLimit])

  const value = useMemo(
    () => ({
      wells,
      filterOptions,
      filters,
      setFilters,
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
