'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Fila que se desplaza de costado (pestañas). Si no entra todo, aparecen
 * flechas a los lados para moverse con el mouse; también se puede usar la
 * rueda del mouse (se convierte en desplazamiento horizontal).
 */
export function Carril({
  children,
  className,
  etiqueta,
  sobreFondo = false,
}: {
  children: React.ReactNode
  className?: string
  etiqueta: string
  /** true si el carril está sobre el fondo "papel" y no sobre un panel. */
  sobreFondo?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hayIzquierda, setHayIzquierda] = useState(false)
  const [hayDerecha, setHayDerecha] = useState(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    setHayIzquierda(el.scrollLeft > 2)
    setHayDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    // También cuando cambian las pestañas de adentro (se agregan o reordenan).
    const mutaciones = new MutationObserver(medir)
    mutaciones.observe(el, { childList: true, subtree: true })
    // Rueda vertical del mouse → desplazamiento horizontal.
    const rueda = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => {
      observador.disconnect()
      mutaciones.disconnect()
      el.removeEventListener('wheel', rueda)
    }
  }, [medir])

  function mover(direccion: -1 | 1) {
    const el = ref.current
    if (el) el.scrollBy({ left: direccion * Math.max(200, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  const flecha =
    'absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-[var(--sombra)] transition-colors hover:border-primary hover:text-primary'

  return (
    <div className={cn('relative min-w-0', className)}>
      {hayIzquierda && (
        <>
          <div className={`pointer-events-none absolute inset-y-0 left-0 z-[5] w-12 bg-gradient-to-r to-transparent ${sobreFondo ? 'from-background' : 'from-surface'}`} aria-hidden />
          <button type="button" onClick={() => mover(-1)} className={cn(flecha, 'left-0')} aria-label={`Ver ${etiqueta} anteriores`}>
            <ChevronLeft className="size-4" />
          </button>
        </>
      )}
      <div
        ref={ref}
        onScroll={medir}
        className="flex items-center gap-1.5 overflow-x-auto scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {hayDerecha && (
        <>
          <div className={`pointer-events-none absolute inset-y-0 right-0 z-[5] w-12 bg-gradient-to-l to-transparent ${sobreFondo ? 'from-background' : 'from-surface'}`} aria-hidden />
          <button type="button" onClick={() => mover(1)} className={cn(flecha, 'right-0')} aria-label={`Ver más ${etiqueta}`}>
            <ChevronRight className="size-4" />
          </button>
        </>
      )}
    </div>
  )
}
