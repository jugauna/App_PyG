import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap, useMapEvents } from 'react-leaflet'

/** Zoom a partir del cual se muestra la brújula (~detalle / escala del orden de decenas de km). */
export const MAP_CROSSHAIR_DETAIL_ZOOM = 10

const CROSSHAIR_OPACITY = '0.82'

/**
 * Brújula cardinal (N-S-E-W) que sigue al cursor solo en zoom de detalle.
 * Posición y opacidad se actualizan vía DOM + rAF para no re-renderizar el mapa.
 */
export function MapCrosshairCardinal() {
  const map = useMap()
  const crosshairRef = useRef<HTMLDivElement | null>(null)
  const [isDetailView, setIsDetailView] = useState(false)
  const isDetailRef = useRef(false)
  const pointerInsideRef = useRef(false)
  const posRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const rafScheduledRef = useRef(false)

  const applyFrame = useCallback(() => {
    rafScheduledRef.current = false
    rafRef.current = null
    const node = crosshairRef.current
    if (!node) return
    const show = isDetailRef.current && pointerInsideRef.current
    node.style.left = `${posRef.current.x}px`
    node.style.top = `${posRef.current.y}px`
    node.style.opacity = show ? CROSSHAIR_OPACITY : '0'
  }, [])

  const scheduleFrame = useCallback(() => {
    if (rafScheduledRef.current) return
    rafScheduledRef.current = true
    rafRef.current = requestAnimationFrame(applyFrame)
  }, [applyFrame])

  const syncDetailZoom = useCallback(() => {
    const next = map.getZoom() >= MAP_CROSSHAIR_DETAIL_ZOOM
    setIsDetailView(next)
    isDetailRef.current = next
    if (!next) {
      pointerInsideRef.current = false
      const node = crosshairRef.current
      if (node) node.style.opacity = '0'
      return
    }
    const el = map.getContainer()
    if (el.matches(':hover')) {
      pointerInsideRef.current = true
      scheduleFrame()
    }
  }, [map, scheduleFrame])

  useMapEvents({
    zoomend: syncDetailZoom,
  })

  useEffect(() => {
    syncDetailZoom()
  }, [syncDetailZoom])

  useEffect(() => {
    const el = map.getContainer()

    const onMove = (e: MouseEvent) => {
      posRef.current.x = e.clientX
      posRef.current.y = e.clientY
      pointerInsideRef.current = true
      if (isDetailRef.current) scheduleFrame()
    }

    const onLeave = () => {
      pointerInsideRef.current = false
      const node = crosshairRef.current
      if (node) node.style.opacity = '0'
    }

    el.addEventListener('mousemove', onMove, { passive: true })
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      rafScheduledRef.current = false
    }
  }, [map, scheduleFrame])

  const crosshair = (
    <div
      ref={crosshairRef}
      aria-hidden
      data-detail-view={isDetailView ? 'true' : 'false'}
      className="pointer-events-none fixed z-[11000] h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 opacity-0"
      style={{
        left: 0,
        top: 0,
        transition: 'opacity 0.3s ease',
        willChange: 'opacity, left, top',
      }}>
      <div className="relative h-full w-full">
        <div className="absolute left-1/2 top-1/2 h-px w-[56px] -translate-x-1/2 -translate-y-1/2 bg-sky-400/45 shadow-[0_0_1px_rgba(15,23,42,0.9)]" />
        <div className="absolute left-1/2 top-1/2 h-[56px] w-px -translate-x-1/2 -translate-y-1/2 bg-sky-400/45 shadow-[0_0_1px_rgba(15,23,42,0.9)]" />
        <span className="absolute left-1/2 top-0 -translate-x-1/2 font-mono text-[9px] font-semibold tracking-wide text-sky-300/85">
          N
        </span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-mono text-[9px] font-semibold tracking-wide text-sky-300/85">
          S
        </span>
        <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] font-semibold tracking-wide text-sky-300/85">
          W
        </span>
        <span className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 font-mono text-[9px] font-semibold tracking-wide text-sky-300/85">
          E
        </span>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(crosshair, document.body)
}
