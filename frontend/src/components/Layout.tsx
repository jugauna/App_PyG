import { Menu, Map } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { SidebarFilters } from './SidebarFilters'

export function Layout({ children }: { children?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-svh flex-col bg-slate-950 text-slate-100">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label={sidebarOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white hover:text-sky-300"
          >
            <Map className="h-5 w-5 text-sky-400" />
            PyG
          </Link>
        </div>
        <span className="hidden text-xs text-slate-500 sm:inline">
          Inteligencia petrolera
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <SidebarFilters
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(false)}
        />
        <main className="min-h-0 min-w-0 flex-1 p-3 sm:p-4">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
