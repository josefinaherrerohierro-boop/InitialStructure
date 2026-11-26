'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Circle,
  Download,
  Eraser,
  ImagePlus,
  Minus,
  PaintBucket,
  Pencil,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import { mensajeDeError, subirArchivo, TAMANIO_MAXIMO_ARCHIVO, urlArchivo } from '@/lib/api'
import type { TipoTrazo, Trazo } from '@/lib/use-voz'
import { cn } from '@/lib/utils'

const COLORES = ['#ecedef', '#ff6b5b', '#e8a33d', '#3fb68b', '#3d9be8', '#7c5cff', '#d9667f', '#15161c']
const GROSORES = [2, 5, 10, 20]
const FONDO = '#ffffff'
/** Alto / ancho de la pizarra (16:10). */
const PROPORCION = 0.625
/** Tamaño del PNG que se exporta. */
const EXPORTAR_ANCHO = 1600

type CajaTexto = { x: number; y: number; texto: string }
type Herramienta = 'lapiz' | 'goma' | 'linea' | 'flecha' | 'rect' | 'elipse' | 'texto'

const HERRAMIENTAS: { id: Herramienta; nombre: string; Icono: typeof Pencil }[] = [
  { id: 'lapiz', nombre: 'Lápiz', Icono: Pencil },
  { id: 'goma', nombre: 'Goma', Icono: Eraser },
  { id: 'linea', nombre: 'Línea', Icono: Minus },
  { id: 'flecha', nombre: 'Flecha', Icono: ArrowUpRight },
  { id: 'rect', nombre: 'Rectángulo', Icono: Square },
  { id: 'elipse', nombre: 'Círculo / elipse', Icono: Circle },
  { id: 'texto', nombre: 'Texto', Icono: Type },
]

/** Tamaño de letra (en una pizarra de 800 px de ancho) según el grosor elegido. */
const tamanioLetra = (grosor: number) => 12 + grosor * 2

// Las imágenes se cargan una vez y quedan guardadas acá.
const imagenes = new Map<string, HTMLImageElement>()
function cargarImagen(url: string, alCargar: () => void): HTMLImageElement {
  let img = imagenes.get(url)
  if (!img) {
    img = new Image()
    // Pedimos la imagen con CORS para poder exportar la pizarra como PNG después.
    img.crossOrigin = 'anonymous'
    img.src = urlArchivo(url) ?? url
    imagenes.set(url, img)
  }
  if (!img.complete) img.addEventListener('load', alCargar, { once: true })
  return img
}

/** Dibuja un elemento en el canvas (las posiciones vienen de 0 a 1). */
function pintar(ctx: CanvasRenderingContext2D, t: Trazo, ancho: number, alto: number, alCargar: () => void) {
  if (t.puntos.length === 0) return
  const tipo: TipoTrazo = t.tipo ?? 'lapiz'
  const escala = ancho / 800
  const color = t.borrador ? FONDO : t.color
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = t.grosor * escala
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const [x0, y0] = [t.puntos[0][0] * ancho, t.puntos[0][1] * alto]
  const [x1, y1] = t.puntos[1] ? [t.puntos[1][0] * ancho, t.puntos[1][1] * alto] : [x0, y0]

  switch (tipo) {
    case 'lapiz': {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      if (t.puntos.length === 1) {
        ctx.arc(x0, y0, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      for (const [x, y] of t.puntos.slice(1)) ctx.lineTo(x * ancho, y * alto)
      ctx.stroke()
      break
    }
    case 'linea':
    case 'flecha': {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      if (tipo === 'flecha' && (x0 !== x1 || y0 !== y1)) {
        const angulo = Math.atan2(y1 - y0, x1 - x0)
        const punta = Math.max(12 * escala, ctx.lineWidth * 3)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x1 - punta * Math.cos(angulo - Math.PI / 7), y1 - punta * Math.sin(angulo - Math.PI / 7))
        ctx.lineTo(x1 - punta * Math.cos(angulo + Math.PI / 7), y1 - punta * Math.sin(angulo + Math.PI / 7))
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'rect': {
      const [x, y, w, h] = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)]
      if (t.relleno) ctx.fillRect(x, y, w, h)
      else ctx.strokeRect(x, y, w, h)
      break
    }
    case 'elipse': {
      ctx.beginPath()
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2)
      if (t.relleno) ctx.fill()
      else ctx.stroke()
      break
    }
    case 'texto': {
      const tamanio = tamanioLetra(t.grosor) * escala
      ctx.font = `600 ${tamanio}px ui-sans-serif, system-ui, sans-serif`
      ctx.textBaseline = 'top'
      ;(t.texto ?? '').split('\n').forEach((linea, i) => ctx.fillText(linea, x0, y0 + i * tamanio * 1.25))
      break
    }
    case 'imagen': {
      const [x, y, w, h] = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)]
      const img = t.url ? cargarImagen(t.url, alCargar) : null
      if (img?.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, w, h)
      } else {
        ctx.fillStyle = '#eceae6'
        ctx.fillRect(x, y, w, h)
      }
      break
    }
  }
  ctx.restore()
}

/** Pizarra compartida: lo que dibuja cada uno lo ven todos los de la llamada. */
export function Pizarra({
  trazos,
  miId,
  nombreCanal,
  onTrazo,
  onDeshacer,
  onLimpiar,
}: {
  trazos: Trazo[]
  miId: number
  nombreCanal: string
  onTrazo: (t: Trazo) => void
  onDeshacer: () => void
  onLimpiar: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const entradaImagen = useRef<HTMLInputElement>(null)
  const actual = useRef<Trazo | null>(null)
  const [herramienta, setHerramienta] = useState<Herramienta>('lapiz')
  const [color, setColor] = useState(COLORES[1])
  const [grosor, setGrosor] = useState(GROSORES[1])
  const [relleno, setRelleno] = useState(false)
  const [tamanio, setTamanio] = useState({ ancho: 800, alto: 500 })
  // Caja de texto abierta (posición de 0 a 1) mientras se escribe.
  const [escribiendo, setEscribiendoEstado] = useState<CajaTexto | null>(null)
  // La caja abierta "de verdad" (el estado puede venir atrasado dentro de un mismo clic).
  const cajaActual = useRef<CajaTexto | null>(null)
  const setEscribiendo = (caja: CajaTexto | null) => {
    cajaActual.current = caja
    setEscribiendoEstado(caja)
  }
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, setCargadas] = useState(0) // cuando termina de cargar una imagen, se redibuja
  const imagenCargada = useCallback(() => setCargadas((n) => n + 1), [])
  const tienePropios = trazos.some((t) => t.autor === miId)

  // El canvas se adapta al lugar libre manteniendo la proporción 16:10.
  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect
      const ancho = Math.max(200, Math.floor(Math.min(width, height / PROPORCION)))
      setTamanio({ ancho, alto: Math.floor(ancho * PROPORCION) })
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  /** Dibuja todo de nuevo (y, si se está dibujando una forma, su vista previa). */
  const redibujar = useCallback(
    (vistaPrevia?: Trazo | null) => {
      const c = canvas.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      const escala = window.devicePixelRatio || 1
      if (c.width !== tamanio.ancho * escala) {
        c.width = tamanio.ancho * escala
        c.height = tamanio.alto * escala
      }
      ctx.setTransform(escala, 0, 0, escala, 0, 0)
      ctx.fillStyle = FONDO
      ctx.fillRect(0, 0, tamanio.ancho, tamanio.alto)
      for (const t of trazos) pintar(ctx, t, tamanio.ancho, tamanio.alto, imagenCargada)
      if (vistaPrevia) pintar(ctx, vistaPrevia, tamanio.ancho, tamanio.alto, imagenCargada)
    },
    [trazos, tamanio, imagenCargada],
  )

  useEffect(() => {
    redibujar(actual.current)
  })

  // Ctrl+Z deshace lo último que dibujaste.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const enCampo = e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !enCampo) {
        e.preventDefault()
        onDeshacer()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onDeshacer])

  function punto(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect()
    return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1)]
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = punto(e)
    if (herramienta === 'texto') {
      e.preventDefault() // que el clic no le saque el foco a la caja nueva
      terminarTexto() // si había una caja abierta, se pone lo que tenía
      setEscribiendo({ x: p[0], y: p[1], texto: '' })
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (herramienta === 'lapiz' || herramienta === 'goma') {
      actual.current = { tipo: 'lapiz', puntos: [p], color, grosor, borrador: herramienta === 'goma', autor: miId }
    } else {
      const forma = herramienta === 'rect' || herramienta === 'elipse'
      actual.current = { tipo: herramienta, puntos: [p, p], color, grosor, autor: miId, ...(forma ? { relleno } : {}) }
    }
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    const t = actual.current
    if (!t) return
    const p = punto(e)
    if (t.tipo === 'lapiz') {
      const ctx = canvas.current?.getContext('2d')
      if (!ctx || t.puntos.length >= 1000) return
      // Dibujamos solo el último tramo mientras se arrastra (es más rápido).
      pintar(ctx, { ...t, puntos: [t.puntos[t.puntos.length - 1], p] }, tamanio.ancho, tamanio.alto, imagenCargada)
      t.puntos.push(p)
    } else {
      // Formas: con Shift, cuadrado / círculo perfecto o línea recta en 45°.
      let fin = p
      if (e.shiftKey) {
        const [x0, y0] = t.puntos[0]
        const dx = (p[0] - x0) * tamanio.ancho
        const dy = (p[1] - y0) * tamanio.alto
        if (t.tipo === 'rect' || t.tipo === 'elipse') {
          const lado = Math.max(Math.abs(dx), Math.abs(dy))
          fin = [x0 + (Math.sign(dx) * lado) / tamanio.ancho, y0 + (Math.sign(dy) * lado) / tamanio.alto]
        } else {
          const angulo = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
          const largo = Math.hypot(dx, dy)
          fin = [x0 + (Math.cos(angulo) * largo) / tamanio.ancho, y0 + (Math.sin(angulo) * largo) / tamanio.alto]
        }
        fin = [Math.min(Math.max(fin[0], 0), 1), Math.min(Math.max(fin[1], 0), 1)]
      }
      t.puntos = [t.puntos[0], fin]
      redibujar(t)
    }
  }

  function terminar() {
    const t = actual.current
    actual.current = null
    if (!t) return
    // Una forma sin tamaño (un clic suelto) no se guarda.
    if (t.tipo !== 'lapiz') {
      const [[x0, y0], [x1, y1]] = t.puntos
      if (Math.abs(x1 - x0) * tamanio.ancho < 3 && Math.abs(y1 - y0) * tamanio.alto < 3) {
        redibujar()
        return
      }
    }
    onTrazo(t)
  }

  function terminarTexto() {
    const caja = cajaActual.current
    setEscribiendo(null)
    if (!caja || !caja.texto.trim()) return
    onTrazo({ tipo: 'texto', puntos: [[caja.x, caja.y]], texto: caja.texto.slice(0, 500), color, grosor, autor: miId })
  }

  async function importarImagen(archivo: File | undefined) {
    if (!archivo) return
    setAviso(null)
    if (!archivo.type.startsWith('image/')) return setAviso('Elegí un archivo de imagen (PNG, JPG, GIF o WebP).')
    if (archivo.size > TAMANIO_MAXIMO_ARCHIVO) return setAviso('La imagen es muy pesada (máximo 15 MB).')
    setSubiendo(true)
    try {
      // Medimos la imagen para respetar sus proporciones.
      const medida = await new Promise<{ w: number; h: number }>((resolver, rechazar) => {
        const img = new Image()
        img.onload = () => resolver({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => rechazar(new Error('No pudimos leer esa imagen.'))
        img.src = URL.createObjectURL(archivo)
      })
      const { url } = await subirArchivo(archivo)
      // Ocupa hasta la mitad del ancho y 70 % del alto, centrada.
      let w = 0.5
      let h = (w * (medida.h / medida.w)) / PROPORCION
      if (h > 0.7) {
        w *= 0.7 / h
        h = 0.7
      }
      onTrazo({ tipo: 'imagen', puntos: [[0.5 - w / 2, 0.5 - h / 2], [0.5 + w / 2, 0.5 + h / 2]], url, color, grosor, autor: miId })
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setSubiendo(false)
      if (entradaImagen.current) entradaImagen.current.value = ''
    }
  }

  async function exportar() {
    setAviso(null)
    const ancho = EXPORTAR_ANCHO
    const alto = Math.round(ancho * PROPORCION)
    // Esperamos a que estén cargadas todas las imágenes.
    await Promise.all(
      trazos
        .filter((t) => t.tipo === 'imagen' && t.url)
        .map(
          (t) =>
            new Promise<void>((resolver) => {
              const img = cargarImagen(t.url!, () => {})
              if (img.complete) return resolver()
              img.addEventListener('load', () => resolver(), { once: true })
              img.addEventListener('error', () => resolver(), { once: true })
            }),
        ),
    )
    const c = document.createElement('canvas')
    c.width = ancho
    c.height = alto
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = FONDO
    ctx.fillRect(0, 0, ancho, alto)
    for (const t of trazos) pintar(ctx, t, ancho, alto, () => {})
    try {
      c.toBlob((blob) => {
        if (!blob) return setAviso('No pudimos exportar la pizarra.')
        const enlace = document.createElement('a')
        const fecha = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')
        enlace.href = URL.createObjectURL(blob)
        enlace.download = `pizarra-${nombreCanal.replace(/[^\w-]+/g, '_')}-${fecha}.png`
        enlace.click()
        setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000)
      }, 'image/png')
    } catch {
      setAviso('No pudimos exportar la pizarra (alguna imagen no se dejó copiar).')
    }
  }

  const boton = (activo: boolean) =>
    cn('rounded-md p-1.5 transition-colors', activo ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:text-foreground')
  const esForma = herramienta === 'rect' || herramienta === 'elipse'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="toolbar" aria-label="Herramientas" className="flex gap-0.5 rounded-lg border border-border bg-surface p-1">
          {HERRAMIENTAS.map(({ id, nombre, Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => setHerramienta(id)}
              aria-pressed={herramienta === id}
              aria-label={nombre}
              title={nombre}
              className={boton(herramienta === id)}
            >
              <Icono className="size-4" />
            </button>
          ))}
          <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
          <button
            type="button"
            onClick={() => entradaImagen.current?.click()}
            disabled={subiendo}
            aria-label="Importar imagen"
            title="Importar imagen"
            className={cn(boton(false), subiendo && 'animate-pulse')}
          >
            <ImagePlus className="size-4" />
          </button>
          <input
            ref={entradaImagen}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => importarImagen(e.target.files?.[0])}
          />
        </div>
        {esForma && (
          <button
            type="button"
            onClick={() => setRelleno((v) => !v)}
            aria-pressed={relleno}
            title={relleno ? 'Forma rellena' : 'Solo el borde'}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors',
              relleno ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
            )}
          >
            <PaintBucket className="size-3.5" aria-hidden />
            Relleno
          </button>
        )}
        <div className="flex gap-1">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c)
                if (herramienta === 'goma') setHerramienta('lapiz')
              }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={cn('size-6 rounded-full border border-border ring-offset-2 ring-offset-background', color === c && herramienta !== 'goma' && 'ring-2 ring-primary')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1" title={herramienta === 'texto' ? 'Tamaño de letra' : 'Grosor'}>
          {GROSORES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrosor(g)}
              aria-label={`${herramienta === 'texto' ? 'Tamaño' : 'Grosor'} ${g}`}
              aria-pressed={grosor === g}
              className={cn('flex size-7 items-center justify-center rounded-md', grosor === g ? 'bg-elevated' : 'hover:bg-elevated/60')}
            >
              {herramienta === 'texto' ? (
                <span className="font-semibold leading-none" style={{ fontSize: 9 + g * 0.6 }}>
                  A
                </span>
              ) : (
                <span className="rounded-full bg-foreground" style={{ width: Math.min(g, 16), height: Math.min(g, 16) }} />
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onDeshacer}
            disabled={!tienePropios}
            title="Deshacer lo último que dibujaste (Ctrl+Z)"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Undo2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">Deshacer</span>
          </button>
          <button
            type="button"
            onClick={exportar}
            title="Descargar la pizarra como imagen PNG"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground"
          >
            <Download className="size-4" aria-hidden />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            type="button"
            onClick={onLimpiar}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">Borrar todo</span>
          </button>
        </div>
      </div>
      <div ref={contenedor} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="relative" style={{ width: tamanio.ancho, height: tamanio.alto }}>
          <canvas
            ref={canvas}
            role="img"
            aria-label="Pizarra compartida"
            style={{ width: tamanio.ancho, height: tamanio.alto }}
            className={cn('touch-none rounded-xl border border-border shadow-inner', herramienta === 'texto' ? 'cursor-text' : 'cursor-crosshair')}
            onPointerDown={empezar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
          />
          {escribiendo && (
            <textarea
              key={`${escribiendo.x}-${escribiendo.y}`}
              autoFocus
              aria-label="Texto para la pizarra"
              value={escribiendo.texto}
              maxLength={500}
              rows={Math.max(1, escribiendo.texto.split('\n').length)}
              onChange={(e) => setEscribiendo({ ...escribiendo, texto: e.target.value })}
              onBlur={() => {
                // Solo si sigue siendo la caja abierta (no una que ya se reemplazó).
                if (cajaActual.current?.x === escribiendo.x && cajaActual.current?.y === escribiendo.y) terminarTexto()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  terminarTexto()
                } else if (e.key === 'Escape') {
                  setEscribiendo(null)
                }
              }}
              placeholder="Escribí… (Enter para poner)"
              className="absolute resize-none overflow-hidden rounded border border-dashed border-primary bg-transparent p-0 font-semibold leading-[1.25] outline-none placeholder:text-black/30"
              style={{
                left: escribiendo.x * tamanio.ancho,
                top: escribiendo.y * tamanio.alto,
                color,
                fontSize: tamanioLetra(grosor) * (tamanio.ancho / 800),
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                width: Math.max(140, (1 - escribiendo.x) * tamanio.ancho - 4),
              }}
            />
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {aviso ? (
          <span className="text-destructive">{aviso}</span>
        ) : (
          'Todos los de la llamada ven y pueden dibujar en esta pizarra. Con Shift, las formas salen perfectas (cuadrado, círculo, líneas a 45°).'
        )}
      </p>
    </div>
  )
}
