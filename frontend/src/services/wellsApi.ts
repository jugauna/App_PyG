import axios from 'axios'

import type { Well, WellMapPoint } from '../types/well'

export function formatWellsFetchError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const st = err.response?.status
    const data = err.response?.data as { detail?: unknown } | undefined
    const detail = data?.detail
    if (typeof detail === 'string') {
      return st ? `HTTP ${st}: ${detail}` : detail
    }
    if (Array.isArray(detail)) {
      return `HTTP ${st ?? '?'}: ${JSON.stringify(detail)}`
    }
    if (st === 502 || st === 503) {
      return `HTTP ${st}: ${err.message}. Si es 502, el backend cerró la conexión o devolvió una respuesta inválida (revisá la consola de uvicorn).`
    }
    if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      return `${err.message} (sin respuesta HTTP). Revisá firewall, que uvicorn use --host 0.0.0.0 y que la URL del API coincida con cómo abrís el front: localhost vs 127.0.0.1).`
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Error al cargar pozos'
}

/** Mismo host que Vite (localhost) evita bloqueos de Chrome entre localhost:5173 y 127.0.0.1:8000. */
const baseURL = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const client = axios.create({
  baseURL,
  timeout: 120_000,
})

export type WellFilters = {
  empresa: string[]
  provincia: string[]
  cuenca: string[]
}

function buildSearchParams(f: WellFilters, limit?: number): string {
  const sp = new URLSearchParams()
  for (const v of f.empresa) {
    if (v) sp.append('empresa', v)
  }
  for (const v of f.provincia) {
    if (v) sp.append('provincia', v)
  }
  for (const v of f.cuenca) {
    if (v) sp.append('cuenca', v)
  }
  if (limit !== undefined) sp.set('limit', String(limit))
  return sp.toString()
}

export type WellFilterOptionsResponse = {
  empresas: string[]
  provincias: string[]
  cuencas: string[]
}

export async function fetchFilterOptions(): Promise<WellFilterOptionsResponse> {
  const { data } = await client.get<WellFilterOptionsResponse>(
    '/api/wells/filter-options',
  )
  return data
}

export type WellMapCountResponse = {
  count: number
}

export async function fetchMapWellsCount(
  filters: WellFilters,
): Promise<WellMapCountResponse> {
  const qs = buildSearchParams(filters)
  const url = qs ? `/api/wells/count?${qs}` : '/api/wells/count'
  const { data } = await client.get<WellMapCountResponse>(url)
  return data
}

export async function fetchMapWells(
  filters: WellFilters,
  limit: number,
): Promise<WellMapPoint[]> {
  const qs = buildSearchParams(filters, limit)
  const url = `/api/wells?${qs}`
  const { data } = await client.get<WellMapPoint[]>(url)
  return data
}

export async function fetchWellDetail(sigla: string): Promise<Well> {
  const { data } = await client.get<Well>(
    `/api/wells/${encodeURIComponent(sigla)}`,
  )
  return data
}

export async function fetchWellSearchSiglas(query: string): Promise<string[]> {
  const t = query.trim()
  if (!t) return []
  const { data } = await client.get<string[]>('/api/wells/search', {
    params: { q: t },
    timeout: 30_000,
  })
  return Array.isArray(data) ? data : []
}

