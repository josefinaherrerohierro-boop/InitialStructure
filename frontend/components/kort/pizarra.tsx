'use client'

import { useEffect, useRef, useState } from 'react'
import { Eraser, Pencil, Trash2 } from 'lucide-react'
import type { Trazo } from '@/lib/use-voz'
import { cn } from '@/lib/utils'

const COLORES = ['#ecedef', '#ff6b5b', '#e8a33d', '#3fb68b', '#3d9be8', '#7c5cff', '#d9667f', '#15161c']
const GROSORES = [2, 5, 10, 20]
const FONDO = '#ffffff'

/** Dibuja un trazo en el canvas. Los puntos vienen de 0 a 1 (así se ve igual en cualquier pantalla). */
function pintar(ctx: CanvasRenderingContext2D, t: Trazo, ancho: number, alto: number) {
  if (t.puntos.length === 0) return
  ctx.strokeStyle = t.borrador ? FONDO : t.color
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = t.grosor * (ancho / 800)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  const [x0, y0] = t.puntos[0]
  ctx.moveTo(x0 * ancho, y0 * alto)
  if (t.puntos.length === 1) {
    ctx.arc(x0 * ancho, y0 * alto, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  for (const [x, y] of t.puntos.slice(1)) ctx.lineTo(x * ancho, y * alto)
  ctx.stroke()
}

/** Pizarra compartida: lo que dibuja cada uno lo ven todos los de la llamada. */
export function Pizarra({
  trazos,
  onTrazo,
  onLimpiar,
}: {
  trazos: Trazo[]
  onTrazo: (t: Trazo) => void
  onLimpiar: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const actual = useRef<Trazo | null>(null)
  const [color, setColor] = useState(COLORES[1])
  const [grosor, setGrosor] = useState(GROSORES[1])
  const [borrador, setBorrador] = useState(false)
  const [tamanio, setTamanio] = useState({ ancho: 800, alto: 500 })

  // El canvas se adapta al ancho disponible (proporción 16:10).
  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    // Lo más grande posible que entre en el lugar libre, manteniendo la proporción 16:10.
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect
      const ancho = Math.max(200, Math.floor(Math.min(width, height / 0.625)))
      setTamanio({ ancho, alto: Math.floor(ancho * 0.625) })
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // Redibuja todo cuando cambian los trazos o el tamaño.
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const escala = window.devicePixelRatio || 1
    c.width = tamanio.ancho * escala
    c.height = tamanio.alto * escala
    ctx.setTransform(escala, 0, 0, escala, 0, 0)
    ctx.fillStyle = FONDO
    ctx.fillRect(0, 0, tamanio.ancho, tamanio.alto)
    for (const t of trazos) pintar(ctx, t, tamanio.ancho, tamanio.alto)
  }, [trazos, tamanio])

  function punto(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect()
    return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1)]
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    actual.current = { puntos: [punto(e)], color, grosor, borrador }
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    const t = actual.current
    const ctx = canvas.current?.getContext('2d')
    if (!t || !ctx || t.puntos.length >= 1000) return
    const p = punto(e)
    // Dibujamos solo el último tramo mientras se arrastra (es más rápido).
    pintar(ctx, { ...t, puntos: [t.puntos[t.puntos.length - 1], p] }, tamanio.ancho, tamanio.alto)
    t.puntos.push(p)
  }

  function terminar() {
    const t = actual.current
    actual.current = null
    if (t) onTrazo(t)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setBorrador(false)}
            aria-pressed={!borrador}
            className={cn('rounded-md p-1.5', !borrador ? 'bg-elevated text-foreground' : 'text-muted-foreground')}
            aria-label="Lápiz"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setBorrador(true)}
            aria-pressed={borrador}
            className={cn('rounded-md p-1.5', borrador ? 'bg-elevated text-foreground' : 'text-muted-foreground')}
            aria-label="Goma"
          >
            <Eraser className="size-4" />
          </button>
        </div>
        <div className="flex gap-1">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c)
                setBorrador(false)
              }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c && !borrador}
              className={cn('size-6 rounded-full border border-border ring-offset-2 ring-offset-background', color === c && !borrador && 'ring-2 ring-primary')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {GROSORES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrosor(g)}
              aria-label={`Grosor ${g}`}
              aria-pressed={grosor === g}
              className={cn('flex size-7 items-center justify-center rounded-md', grosor === g ? 'bg-elevated' : 'hover:bg-elevated/60')}
            >
              <span className="rounded-full bg-foreground" style={{ width: Math.min(g, 16), height: Math.min(g, 16) }} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onLimpiar}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
          Borrar todo
        </button>
      </div>
      <div ref={contenedor} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <canvas
          ref={canvas}
          role="img"
          aria-label="Pizarra compartida"
          style={{ width: tamanio.ancho, height: tamanio.alto }}
          className="cursor-crosshair touch-none rounded-xl border border-border shadow-inner"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
      </div>
      <p className="text-xs text-muted-foreground">Todos los de la llamada ven y pueden dibujar en esta pizarra.</p>
    </div>
  )
}
