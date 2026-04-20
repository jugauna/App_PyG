import { Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useWells } from '../context/WellsContext'
import { fetchWellSearchSiglas, formatWellsFetchError } from '../services/wellsApi'

/** Misma sincronización de año que el mapa (`useWells().anio`). */
function openWellDetailTab(sigla: string, anioContexto: number) {
  window.open(
    `${window.location.origin}/pozo/${encodeURIComponent(sigla)}?anio=${anioContexto}`,
    '_blank',
    'noopener,noreferrer',
  )
}

export function WellSearch() {
  const { anio } = useWells()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 240)
    return () => window.clearTimeout(id)
  }, [query])

  useEffect(() => {
    if (!debounced) {
      setSuggestions([])
      setErr(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const list = await fetchWellSearchSiglas(debounced, anio)
        if (!cancelled) {
          setSuggestions(list)
          setHighlight(0)
        }
      } catch (e) {
        if (!cancelled) {
          setSuggestions([])
          setErr(formatWellsFetchError(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, anio])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = useCallback((sigla: string) => {
    openWellDetailTab(sigla, anio)
    setOpen(false)
    setQuery('')
    setDebounced('')
    setSuggestions([])
    inputRef.current?.blur()
  }, [anio])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (suggestions.length === 0) return
      e.preventDefault()
      const i = Math.min(highlight, suggestions.length - 1)
      pick(suggestions[i])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && debounced.length > 0 && (suggestions.length > 0 || loading || err)

  return (
    <div ref={wrapRef} className="relative z-20">
      <label htmlFor="well-global-search" className="sr-only">
        Buscar pozo por sigla
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          ref={inputRef}
          id="well-global-search"
          type="search"
          autoComplete="off"
          placeholder="Buscar sigla…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/80 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        />
      </div>

      {showList && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-600 bg-slate-900 py-1 shadow-xl ring-1 ring-slate-800"
        >
          {loading && (
            <li className="px-3 py-2 text-xs text-slate-500">Buscando…</li>
          )}
          {err && (
            <li className="px-3 py-2 text-xs text-amber-200/90">{err}</li>
          )}
          {!loading &&
            !err &&
            suggestions.length === 0 &&
            debounced.length > 0 && (
              <li className="px-3 py-2 text-xs text-slate-500">
                Sin coincidencias
              </li>
            )}
          {suggestions.map((sigla, i) => (
            <li key={sigla} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={`flex w-full px-3 py-2 text-left font-mono text-sm hover:bg-slate-800 ${
                  i === highlight ? 'bg-slate-800 text-sky-200' : 'text-slate-200'
                }`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(sigla)}
              >
                {sigla}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
