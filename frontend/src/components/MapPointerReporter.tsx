import { useCallback, useEffect, useRef } from 'react'
import { useMapEvents } from 'react-leaflet'

type Props = {
  onMove: (lat: number, lon: number) => void
}

/**
 * Reporta lat/lng del puntero sobre el mapa (rAF). Sin UI; no debe vivir en el header.
 */
export function MapPointerReporter({ onMove }: Props) {
  const pendingRef = useRef({ lat: 0, lon: 0 })
  const rafRef = useRef<number | null>(null)
  const scheduledRef = useRef(false)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  const flush = useCallback(() => {
    scheduledRef.current = false
    rafRef.current = null
    const { lat, lon } = pendingRef.current
    onMoveRef.current(lat, lon)
  }, [])

  const schedule = useCallback(() => {
    if (scheduledRef.current) return
    scheduledRef.current = true
    rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  useMapEvents({
    mousemove(e) {
      pendingRef.current = { lat: e.latlng.lat, lon: e.latlng.lng }
      schedule()
    },
  })

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return null
}
