'use client'

/**
 * Pestañas de un servidor: resumen, canales, salas de voz y herramientas.
 *
 * - Se pueden ver en fila (arriba) o en columna (a la izquierda).
 * - Cada persona las ordena a su gusto y las agrupa en carpetas propias
 *   (modo "Organizar"). Eso se guarda en su membresía: los demás no lo ven.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import {
  AudioLines,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderInput,
  FolderOpen,
  FolderOutput,
  FolderPlus,
  GripVertical,
  LayoutDashboard,
  ListTodo,
  Lock,
  MessageCircle,
  Newspaper,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Trophy,
} from 'lucide-react'
import {
  getMiMembresia,
  getParticipantesVoz,
  mensajeDeError,
  ordenarMisSecciones,
  type Canal,
  type Carpeta,
  type MiMembresia,
} from '@/lib/api'
import type { Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Carril } from './carril'
import { useToast } from './toast-provider'
import { Avatar } from './ui'

export type Herramienta = 'publicaciones' | 'calendario' | 'tareas' | 'scoreboard'

export const HERRAMIENTAS: { id: Herramienta; nombre: string; Icono: typeof Trophy }[] = [
  { id: 'publicaciones', nombre: 'Publicaciones', Icono: Newspaper },
  { id: 'calendario', nombre: 'Calendario', Icono: CalendarDays },
  { id: 'tareas', nombre: 'Tareas', Icono: ListTodo },
  { id: 'scoreboard', nombre: 'Scoreboard', Icono: Trophy },
]

/** Lo que se ve en el centro: el resumen, un canal o una herramienta. */
export type VistaServidor = 'resumen' | Herramienta
export type Orientacion = 'horizontal' | 'vertical'

type Item =
  | { tipo: 'resumen'; id: 'resumen' }
  | { tipo: 'canal'; id: number; canal: Canal }
  | { tipo: 'herramienta'; id: Herramienta }

type Diseno = { orden: string[]; carpetas: Carpeta[] }

type Entrada = { clave: string; item: Item } | { clave: string; carpeta: Carpeta; hijos: Item[] }

/** Claves para guardar el diseño: "resumen", "canal:5", "calendario", "carpeta:a1"... */
const claveDe = (item: Item) => (item.tipo === 'canal' ? `canal:${item.id}` : String(item.id))
const claveCarpeta = (id: string) => `carpeta:${id}`
const esCarpeta = (e: Entrada): e is Extract<Entrada, { carpeta: Carpeta }> => 'carpeta' in e

function nombreDe(item: Item): string {
  if (item.tipo === 'resumen') return 'Resumen'
  if (item.tipo === 'canal') return item.canal.nombre
  return HERRAMIENTAS.find((h) => h.id === item.id)!.nombre
}

/** Arma lo que se ve: las pestañas sueltas y las carpetas, en el orden guardado. */
function armarEntradas(items: Item[], diseno: Diseno): Entrada[] {
  const porClave = new Map(items.map((i) => [claveDe(i), i]))
  const carpetas = diseno.carpetas.map((c) => ({ ...c, items: c.items.filter((k) => porClave.has(k)) }))
  const adentro = new Set(carpetas.flatMap((c) => c.items))
  const entradas: Entrada[] = [
    ...items.filter((i) => !adentro.has(claveDe(i))).map((i) => ({ clave: claveDe(i), item: i })),
    ...carpetas.map((c) => ({ clave: claveCarpeta(c.id), carpeta: c, hijos: c.items.map((k) => porClave.get(k)!) })),
  ]
  const posicion = new Map(diseno.orden.map((k, i) => [k, i]))
  return entradas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (posicion.get(a.e.clave) ?? Infinity) - (posicion.get(b.e.clave) ?? Infinity) || a.i - b.i)
    .map((x) => x.e)
}

const pastilla = (activo: boolean, vertical: boolean) =>
  cn(
    'flex shrink-0 items-center gap-2 border text-sm transition-colors',
    vertical ? 'h-10 w-full rounded-xl px-3 text-left' : 'h-9 rounded-full px-3.5',
    activo
      ? 'border-foreground bg-foreground font-semibold text-background'
      : vertical
        ? 'border-transparent text-muted-foreground hover:bg-elevated hover:text-foreground'
        : 'border-border bg-surface text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground',
  )

/** Sala de voz: muestra las caritas de quienes están adentro. */
function PastillaSala({
  canal,
  activo,
  vertical,
  onClick,
}: {
  canal: Canal
  activo: boolean
  vertical: boolean
  onClick: () => void
}) {
  const { data } = useSWR(['voz', canal.id], () => getParticipantesVoz(canal.id), {
    refreshInterval: 3000,
    onError: () => {},
  })
  const presentes = data ?? []
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      aria-label={`Sala de voz ${canal.nombre}${presentes.length ? `, ${presentes.length} conectados` : ''}`}
      className={cn(pastilla(activo, vertical), presentes.length > 0 && !activo && 'border-success/50')}
    >
      <AudioLines className={cn('size-4 shrink-0', presentes.length > 0 && 'text-success')} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{canal.nombre}</span>
      {presentes.length > 0 && (
        <span className="flex -space-x-1.5">
          {presentes.slice(0, 3).map((p) => (
            <Avatar key={p.usuario_id} nombre={p.username} tamanio="sm" className="size-5 rounded-full text-[8px] ring-2 ring-surface" />
          ))}
        </span>
      )}
    </button>
  )
}

/** Menú flotante (se dibuja sobre todo, así no lo corta el carril con scroll). */
function MenuFlotante({
  ancla,
  onCerrar,
  children,
}: {
  ancla: HTMLElement
  onCerrar: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const r = ancla.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 270) })
  }, [ancla])

  useEffect(() => {
    const cerrar = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !ancla.contains(e.target as Node)) onCerrar()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', tecla)
    window.addEventListener('resize', onCerrar)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('resize', onCerrar)
    }
  }, [ancla, onCerrar])

  if (!pos) return null
  return createPortal(
    <div ref={ref} role="menu" className="panel fixed z-50 flex w-64 flex-col gap-0.5 p-1.5" style={{ top: pos.top, left: pos.left }}>
      {children}
    </div>,
    document.body,
  )
}

export function SeccionesServidor({
  servidorId,
  canales,
  canalId,
  vista,
  permisos,
  orientacion,
  onCanal,
  onVista,
  onCrearCanal,
}: {
  servidorId: number
  canales: Canal[] | undefined
  canalId: number | undefined
  vista: VistaServidor | null
  permisos: Permisos
  orientacion: Orientacion
  onCanal: (id: number) => void
  onVista: (v: VistaServidor) => void
  onCrearCanal: () => void
}) {
  const toast = useToast()
  const vertical = orientacion === 'vertical'
  const { data: membresia, mutate } = useSWR(['mi-membresia', servidorId], () => getMiMembresia(servidorId))
  const [organizando, setOrganizando] = useState(false)
  // Mientras se organiza, se trabaja sobre un borrador que se ve al instante.
  const [borrador, setBorrador] = useState<Diseno | null>(null)
  const borradorRef = useRef<Diseno | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [sobreCarpeta, setSobreCarpeta] = useState<string | null>(null)
  const [menuCarpeta, setMenuCarpeta] = useState<{ id: string; ancla: HTMLElement } | null>(null)
  const [menuMover, setMenuMover] = useState<{ clave: string; ancla: HTMLElement } | null>(null)
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({})

  const items: Item[] = [
    { tipo: 'resumen', id: 'resumen' },
    ...(canales ?? []).filter((c) => c.tipo === 'texto').map((c) => ({ tipo: 'canal' as const, id: c.id, canal: c })),
    ...(canales ?? []).filter((c) => c.tipo === 'voz').map((c) => ({ tipo: 'canal' as const, id: c.id, canal: c })),
    ...HERRAMIENTAS.map((h) => ({ tipo: 'herramienta' as const, id: h.id })),
  ]
  const guardado: Diseno = { orden: membresia?.orden_secciones ?? [], carpetas: membresia?.carpetas ?? [] }
  const diseno = borrador ?? guardado
  const entradas = armarEntradas(items, diseno)
  const personalizado = guardado.orden.length > 0 || guardado.carpetas.length > 0

  function cambiarBorrador(d: Diseno) {
    borradorRef.current = d
    setBorrador(d)
  }

  /** El diseño tal como se ve ahora (con el orden de todo lo que hay). */
  const normalizar = (d: Diseno): Diseno => ({ orden: armarEntradas(items, d).map((e) => e.clave), carpetas: d.carpetas })

  async function guardar(d: Diseno | null) {
    const final = d ? normalizar(d) : { orden: [], carpetas: [] }
    try {
      await mutate(ordenarMisSecciones(servidorId, final.orden, final.carpetas), {
        optimisticData: (actual?: MiMembresia) =>
          ({ ...(actual as MiMembresia), orden_secciones: final.orden.length ? final.orden : null, carpetas: final.carpetas }),
        rollbackOnError: true,
        revalidate: false,
      })
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  function aplicar(d: Diseno) {
    const n = normalizar(d)
    cambiarBorrador(n)
    guardar(n)
  }

  // ---------- Operaciones del modo Organizar ----------
  const carpetaDe = (d: Diseno, clave: string) => d.carpetas.find((c) => c.items.includes(clave))

  /** Mueve una pestaña o carpeta a la posición `indice` de la lista principal (en vivo). */
  function moverA(d: Diseno, clave: string, indice: number): Diseno {
    let carpetas = d.carpetas
    const origen = carpetaDe(d, clave)
    if (origen) carpetas = carpetas.map((c) => (c.id === origen.id ? { ...c, items: c.items.filter((k) => k !== clave) } : c))
    const orden = armarEntradas(items, { orden: d.orden, carpetas }).map((e) => e.clave).filter((k) => k !== clave)
    orden.splice(Math.max(0, Math.min(indice, orden.length)), 0, clave)
    return { orden, carpetas }
  }

  function meterEnCarpeta(clave: string, carpetaId: string) {
    const d = diseno
    const carpetas = d.carpetas.map((c) => {
      const sin = c.items.filter((k) => k !== clave)
      return c.id === carpetaId ? { ...c, items: [...sin, clave] } : { ...c, items: sin }
    })
    aplicar({ orden: d.orden.filter((k) => k !== clave), carpetas })
  }

  function sacarDeCarpeta(clave: string) {
    const d = diseno
    const origen = carpetaDe(d, clave)
    if (!origen) return
    const indice = entradas.findIndex((e) => e.clave === claveCarpeta(origen.id)) + 1
    aplicar(moverA(d, clave, indice))
  }

  function moverDentro(carpetaId: string, clave: string, delta: -1 | 1) {
    aplicar({
      orden: diseno.orden,
      carpetas: diseno.carpetas.map((c) => {
        if (c.id !== carpetaId) return c
        const lista = [...c.items]
        const i = lista.indexOf(clave)
        const j = i + delta
        if (i < 0 || j < 0 || j >= lista.length) return c
        ;[lista[i], lista[j]] = [lista[j], lista[i]]
        return { ...c, items: lista }
      }),
    })
  }

  function nuevaCarpeta() {
    const id = Math.random().toString(36).slice(2, 8)
    const nombre = `Carpeta ${diseno.carpetas.length + 1}`
    aplicar({ orden: [...entradas.map((e) => e.clave), claveCarpeta(id)], carpetas: [...diseno.carpetas, { id, nombre, items: [] }] })
  }

  function renombrar(id: string, nombre: string) {
    const limpio = nombre.trim().slice(0, 30)
    if (!limpio) return
    aplicar({ orden: diseno.orden, carpetas: diseno.carpetas.map((c) => (c.id === id ? { ...c, nombre: limpio } : c)) })
  }

  function borrarCarpeta(id: string) {
    // Lo que tenía adentro vuelve a quedar suelto, en el lugar de la carpeta.
    const carpeta = diseno.carpetas.find((c) => c.id === id)
    if (!carpeta) return
    const orden = entradas.flatMap((e) => (e.clave === claveCarpeta(id) ? carpeta.items : [e.clave]))
    aplicar({ orden, carpetas: diseno.carpetas.filter((c) => c.id !== id) })
  }

  function empezarAOrganizar() {
    cambiarBorrador(normalizar(guardado))
    setOrganizando(true)
  }

  function terminar() {
    setOrganizando(false)
    setBorrador(null)
    borradorRef.current = null
  }

  // ---------- Arrastrar (en vivo) ----------
  function alPasarPor(e: React.DragEvent, destino: Entrada, indice: number) {
    if (!arrastrando || arrastrando === destino.clave) return
    e.preventDefault()
    const d = borradorRef.current ?? diseno
    // Una pestaña sobre una carpeta: se ofrece meterla adentro (no se reordena).
    if (esCarpeta(destino) && !arrastrando.startsWith('carpeta:')) {
      setSobreCarpeta(destino.carpeta.id)
      return
    }
    setSobreCarpeta(null)
    const actual = armarEntradas(items, d).findIndex((x) => x.clave === arrastrando)
    if (actual === indice) return
    cambiarBorrador(moverA(d, arrastrando, indice))
  }

  function alSoltar(e: React.DragEvent, destino?: Entrada) {
    e.preventDefault()
    const clave = arrastrando
    setArrastrando(null)
    setSobreCarpeta(null)
    if (!clave) return
    if (destino && esCarpeta(destino) && !clave.startsWith('carpeta:')) {
      meterEnCarpeta(clave, destino.carpeta.id)
      return
    }
    if (borradorRef.current) guardar(borradorRef.current)
  }

  // ---------- Dibujo ----------
  function renderItem(item: Item) {
    if (item.tipo === 'resumen') {
      const activo = vista === 'resumen'
      return (
        <button type="button" onClick={() => onVista('resumen')} aria-current={activo ? 'page' : undefined} className={pastilla(activo, vertical)}>
          <LayoutDashboard className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Resumen</span>
        </button>
      )
    }
    if (item.tipo === 'canal') {
      const c = item.canal
      const activo = vista === null && c.id === canalId
      if (c.tipo === 'voz') return <PastillaSala canal={c} activo={activo} vertical={vertical} onClick={() => onCanal(c.id)} />
      return (
        <button type="button" onClick={() => onCanal(c.id)} aria-current={activo ? 'page' : undefined} className={pastilla(activo, vertical)}>
          <MessageCircle className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
          {c.solo_lectura && <Lock className="size-3 shrink-0 opacity-70" aria-label="Solo lectura" />}
        </button>
      )
    }
    const h = HERRAMIENTAS.find((x) => x.id === item.id)!
    const activo = vista === h.id
    return (
      <button type="button" onClick={() => onVista(h.id)} aria-current={activo ? 'page' : undefined} className={pastilla(activo, vertical)}>
        <h.Icono className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{h.nombre}</span>
      </button>
    )
  }

  const activoEn = (hijos: Item[]) =>
    hijos.some((h) => (h.tipo === 'canal' ? vista === null && h.id === canalId : vista === h.id))

  /** Carpeta en modo normal: en fila abre un menú; en columna se despliega. */
  function renderCarpeta(e: Extract<Entrada, { carpeta: Carpeta }>) {
    const activa = activoEn(e.hijos)
    if (vertical) {
      const abierta = abiertas[e.carpeta.id] ?? true
      return (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setAbiertas((a) => ({ ...a, [e.carpeta.id]: !abierta }))}
            aria-expanded={abierta}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition-colors hover:bg-elevated',
              activa && !abierta ? 'text-primary' : 'text-foreground',
            )}
          >
            {abierta ? <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden /> : <Folder className="size-4 shrink-0 text-primary" aria-hidden />}
            <span className="min-w-0 flex-1 truncate">{e.carpeta.nombre}</span>
            <span className="text-xs font-normal text-muted-foreground">{e.hijos.length}</span>
            <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !abierta && '-rotate-90')} aria-hidden />
          </button>
          {abierta && (
            <div className="ml-3 flex flex-col gap-0.5 border-l-2 border-primary/25 pl-2">
              {e.hijos.length === 0 ? (
                <p className="px-3 py-1.5 text-xs text-muted-foreground">Vacía. Agregale cosas con “Organizar”.</p>
              ) : (
                e.hijos.map((h) => <div key={claveDe(h)}>{renderItem(h)}</div>)
              )}
            </div>
          )}
        </div>
      )
    }
    return (
      <button
        type="button"
        onClick={(ev) => setMenuCarpeta(menuCarpeta?.id === e.carpeta.id ? null : { id: e.carpeta.id, ancla: ev.currentTarget })}
        aria-expanded={menuCarpeta?.id === e.carpeta.id}
        aria-haspopup="menu"
        className={cn(
          'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
          activa
            ? 'border-foreground bg-foreground font-semibold text-background'
            : 'border-primary/40 bg-primary/8 text-foreground hover:border-primary',
        )}
      >
        <Folder className={cn('size-4', !activa && 'text-primary')} aria-hidden />
        {e.carpeta.nombre}
        <span className={cn('rounded-full px-1.5 text-[11px]', activa ? 'bg-background/20' : 'bg-primary/15 text-primary')}>{e.hijos.length}</span>
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </button>
    )
  }

  // ---------- Modo Organizar ----------
  const chip = (item: Item) => {
    const Icono =
      item.tipo === 'resumen'
        ? LayoutDashboard
        : item.tipo === 'canal'
          ? item.canal.tipo === 'voz'
            ? AudioLines
            : MessageCircle
          : HERRAMIENTAS.find((h) => h.id === item.id)!.Icono
    return (
      <>
        <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{nombreDe(item)}</span>
      </>
    )
  }

  const botonMini = 'rounded-full p-1 text-muted-foreground hover:bg-elevated hover:text-primary disabled:opacity-25'

  function renderOrganizar() {
    return (
      <div className="flex flex-col gap-2">
        <div
          className={cn('flex gap-2', vertical ? 'flex-col' : 'flex-wrap items-start')}
          onDragOver={(e) => arrastrando && e.preventDefault()}
          onDrop={(e) => alSoltar(e)}
        >
          {entradas.map((e, i) => {
            const comun = {
              'data-entrada': e.clave,
              draggable: true,
              onDragStart: (ev: React.DragEvent) => {
                ev.dataTransfer.effectAllowed = 'move'
                ev.dataTransfer.setData('text/plain', e.clave)
                setArrastrando(e.clave)
              },
              onDragOver: (ev: React.DragEvent) => alPasarPor(ev, e, i),
              onDragLeave: () => esCarpeta(e) && setSobreCarpeta((v) => (v === e.carpeta.id ? null : v)),
              onDrop: (ev: React.DragEvent) => {
                ev.stopPropagation()
                alSoltar(ev, e)
              },
              onDragEnd: () => {
                setArrastrando(null)
                setSobreCarpeta(null)
                if (borradorRef.current) guardar(borradorRef.current)
              },
            }
            if (esCarpeta(e)) {
              const id = e.carpeta.id
              return (
                <div
                  key={e.clave}
                  {...comun}
                  className={cn(
                    'flex cursor-grab flex-col gap-1.5 rounded-2xl border-2 border-dashed bg-primary/5 p-2 transition-colors',
                    vertical ? 'w-full' : 'min-w-56',
                    sobreCarpeta === id ? 'border-primary bg-primary/15' : 'border-primary/40',
                    arrastrando === e.clave && 'opacity-40',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <Folder className="size-4 shrink-0 text-primary" aria-hidden />
                    <input
                      aria-label="Nombre de la carpeta"
                      defaultValue={e.carpeta.nombre}
                      maxLength={30}
                      onBlur={(ev) => ev.target.value.trim() !== e.carpeta.nombre && renombrar(id, ev.target.value)}
                      onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
                      className="h-7 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 text-sm font-semibold outline-none hover:border-border focus:border-primary focus:bg-surface"
                    />
                    <button type="button" onClick={() => borrarCarpeta(id)} className={botonMini} aria-label={`Borrar la carpeta ${e.carpeta.nombre}`} title="Borrar carpeta (lo de adentro queda suelto)">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {e.hijos.length === 0 ? (
                    <p className="px-2 pb-1 text-xs text-muted-foreground">Arrastrá pestañas acá adentro.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {e.hijos.map((h, j) => {
                        const clave = claveDe(h)
                        return (
                          <li
                            key={clave}
                            draggable
                            onDragStart={(ev) => {
                              ev.stopPropagation()
                              ev.dataTransfer.effectAllowed = 'move'
                              ev.dataTransfer.setData('text/plain', clave)
                              setArrastrando(clave)
                            }}
                            onDragEnd={() => {
                              setArrastrando(null)
                              setSobreCarpeta(null)
                              if (borradorRef.current) guardar(borradorRef.current)
                            }}
                            className={cn(
                              'flex h-8 cursor-grab items-center gap-1.5 rounded-xl border border-border bg-surface px-2 text-sm',
                              arrastrando === clave && 'opacity-40',
                            )}
                          >
                            {chip(h)}
                            <button type="button" onClick={() => moverDentro(id, clave, -1)} disabled={j === 0} className={botonMini} aria-label={`Subir ${nombreDe(h)}`}>
                              <ChevronLeft className={cn('size-3.5', vertical && 'rotate-90')} />
                            </button>
                            <button type="button" onClick={() => moverDentro(id, clave, 1)} disabled={j === e.hijos.length - 1} className={botonMini} aria-label={`Bajar ${nombreDe(h)}`}>
                              <ChevronRight className={cn('size-3.5', vertical && 'rotate-90')} />
                            </button>
                            <button type="button" onClick={() => sacarDeCarpeta(clave)} className={botonMini} aria-label={`Sacar ${nombreDe(h)} de la carpeta`} title="Sacar de la carpeta">
                              <FolderOutput className="size-3.5" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            }
            return (
              <div
                key={e.clave}
                {...comun}
                className={cn(
                  'flex h-9 cursor-grab items-center gap-1.5 rounded-full border border-border bg-surface pr-1 pl-2 text-sm shadow-[var(--sombra)] transition-transform',
                  vertical && 'w-full rounded-xl',
                  arrastrando === e.clave && 'scale-95 opacity-40',
                )}
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {chip(e.item)}
                <button type="button" onClick={() => aplicar(moverA(diseno, e.clave, i - 1))} disabled={i === 0} className={botonMini} aria-label={`Mover ${nombreDe(e.item)} antes`}>
                  <ChevronLeft className={cn('size-3.5', vertical && 'rotate-90')} />
                </button>
                <button type="button" onClick={() => aplicar(moverA(diseno, e.clave, i + 1))} disabled={i === entradas.length - 1} className={botonMini} aria-label={`Mover ${nombreDe(e.item)} después`}>
                  <ChevronRight className={cn('size-3.5', vertical && 'rotate-90')} />
                </button>
                {diseno.carpetas.length > 0 && (
                  <button
                    type="button"
                    onClick={(ev) => setMenuMover({ clave: e.clave, ancla: ev.currentTarget })}
                    className={botonMini}
                    aria-label={`Meter ${nombreDe(e.item)} en una carpeta`}
                    title="Meter en una carpeta"
                  >
                    <FolderInput className="size-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={nuevaCarpeta}
            disabled={diseno.carpetas.length >= 20}
            className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-primary/60 px-3 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <FolderPlus className="size-3.5" aria-hidden />
            Nueva carpeta
          </button>
          {personalizado && (
            <button
              type="button"
              onClick={() => {
                cambiarBorrador(normalizar({ orden: [], carpetas: [] }))
                guardar(null)
              }}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Volver al original
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={terminar}
            className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <Check className="size-3.5" aria-hidden />
            Listo
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Arrastrá para ordenar (se ve en vivo) o soltá sobre una carpeta para meter algo adentro. Las carpetas y el orden son solo tuyos.
        </p>
      </div>
    )
  }

  const botonOrganizar = (
    <button
      type="button"
      onClick={empezarAOrganizar}
      title="Ordenar y agrupar en carpetas (solo para vos)"
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full text-xs font-medium text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground',
        vertical ? 'h-9 w-full justify-center border border-dashed border-border' : 'h-9 px-3',
      )}
    >
      <Settings2 className="size-3.5" aria-hidden />
      <span className={cn(!vertical && 'hidden sm:inline')}>Organizar</span>
    </button>
  )

  const botonCrear = permisos.esModerador && (
    <button
      type="button"
      onClick={onCrearCanal}
      className={cn(
        'flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary',
        vertical ? 'h-9 w-full text-xs' : 'size-9',
      )}
      aria-label="Crear canal"
      title="Crear canal"
    >
      <Plus className="size-4" />
      {vertical && 'Crear canal'}
    </button>
  )

  const menus = (
    <>
      {menuCarpeta &&
        (() => {
          const e = entradas.find((x) => x.clave === claveCarpeta(menuCarpeta.id))
          if (!e || !esCarpeta(e)) return null
          return (
            <MenuFlotante ancla={menuCarpeta.ancla} onCerrar={() => setMenuCarpeta(null)}>
              <p className="flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground">
                <FolderOpen className="size-3.5 text-primary" aria-hidden />
                {e.carpeta.nombre}
              </p>
              {e.hijos.length === 0 ? (
                <p className="px-2 pb-1.5 text-xs text-muted-foreground">Vacía. Agregale cosas con “Organizar”.</p>
              ) : (
                e.hijos.map((h) => (
                  <div key={claveDe(h)} onClick={() => setMenuCarpeta(null)}>
                    {filaMenu(h)}
                  </div>
                ))
              )}
            </MenuFlotante>
          )
        })()}
      {menuMover && (
        <MenuFlotante ancla={menuMover.ancla} onCerrar={() => setMenuMover(null)}>
          <p className="px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground">Meter en…</p>
          {diseno.carpetas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                meterEnCarpeta(menuMover.clave, c.id)
                setMenuMover(null)
              }}
              className="flex h-9 items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-elevated"
            >
              <Folder className="size-4 text-primary" aria-hidden />
              {c.nombre}
            </button>
          ))}
        </MenuFlotante>
      )}
    </>
  )

  /** Fila de una pestaña dentro del menú de una carpeta (vista en fila). */
  function filaMenu(item: Item) {
    const activo = item.tipo === 'resumen' ? vista === 'resumen' : item.tipo === 'canal' ? vista === null && item.id === canalId : vista === item.id
    return (
      <button
        type="button"
        onClick={() => (item.tipo === 'canal' ? onCanal(item.id) : onVista(item.id))}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-sm',
          activo ? 'bg-foreground font-semibold text-background' : 'hover:bg-elevated',
        )}
      >
        {chip(item)}
      </button>
    )
  }

  if (organizando) {
    return (
      <div className={cn(vertical ? 'flex h-full flex-col overflow-y-auto p-3' : 'pt-1')}>
        {renderOrganizar()}
        {menus}
      </div>
    )
  }

  if (vertical) {
    return (
      <nav aria-label="Secciones del servidor" className="scrollbar-thin flex h-full flex-col gap-1 overflow-y-auto p-3">
        {entradas.map((e) => (
          <div key={e.clave}>{esCarpeta(e) ? renderCarpeta(e) : renderItem(e.item)}</div>
        ))}
        <div className="mt-2 flex flex-col gap-1.5">
          {botonCrear}
          {botonOrganizar}
        </div>
        {menus}
      </nav>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Carril etiqueta="pestañas" className="flex-1">
        {entradas.map((e) => (
          <div key={e.clave} className="shrink-0">
            {esCarpeta(e) ? renderCarpeta(e) : renderItem(e.item)}
          </div>
        ))}
        {botonCrear}
      </Carril>
      {botonOrganizar}
      {menus}
    </div>
  )
}
