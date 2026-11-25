'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  ArrowLeftRight,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Hourglass,
  LayoutDashboard,
  ListTodo,
  Lock,
  MessageCircle,
  Newspaper,
  Plus,
  RotateCcw,
  Settings,
  Trophy,
  UserPlus,
} from 'lucide-react'
import { getMiMembresia, getParticipantesVoz, mensajeDeError, ordenarMisSecciones, type Canal, type Servidor } from '@/lib/api'
import type { Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Carril } from './carril'
import { tiempoRestante } from './server-selector'
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

/** Íconos propios de Kort para los canales (en vez del "#"). */
export const IconoCanal = ({ tipo, className }: { tipo: Canal['tipo']; className?: string }) =>
  tipo === 'voz' ? <AudioLines className={className} aria-hidden /> : <MessageCircle className={className} aria-hidden />

const pastilla = (activo: boolean) =>
  cn(
    'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
    activo
      ? 'border-foreground bg-foreground font-semibold text-background'
      : 'border-border bg-surface text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground',
  )

/** Sala de voz: muestra las caritas de quienes están adentro. */
function PastillaSala({ canal, activo, onClick }: { canal: Canal; activo: boolean; onClick: () => void }) {
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
      className={cn(pastilla(activo), presentes.length > 0 && !activo && 'border-success/50')}
    >
      <AudioLines className={cn('size-4', presentes.length > 0 && 'text-success')} aria-hidden />
      {canal.nombre}
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

/**
 * Barra de un servidor (arriba del contenido): nombre, resumen, canales,
 * salas de voz y herramientas. Reemplaza la columna de canales.
 */
/** Claves de las pestañas para guardar el orden personal: "resumen", "canal:5", "calendario"... */
const claveDe = (item: { tipo: 'resumen' | 'canal' | 'herramienta'; id: string | number }) =>
  item.tipo === 'canal' ? `canal:${item.id}` : String(item.id)

type Item =
  | { tipo: 'resumen'; id: 'resumen' }
  | { tipo: 'canal'; id: number; canal: Canal }
  | { tipo: 'herramienta'; id: Herramienta }

/** Aplica el orden guardado; lo que no está en la lista (canales nuevos) va al final. */
function ordenar(items: Item[], orden: string[] | null | undefined): Item[] {
  if (!orden?.length) return items
  const posicion = new Map(orden.map((clave, i) => [clave, i]))
  return [...items].sort(
    (a, b) => (posicion.get(claveDe(a)) ?? Infinity) - (posicion.get(claveDe(b)) ?? Infinity) || items.indexOf(a) - items.indexOf(b),
  )
}

/**
 * Barra de un servidor (arriba del contenido): nombre, resumen, canales,
 * salas de voz y herramientas. Cada persona puede ordenar las pestañas a su
 * gusto con "Ordenar"; ese orden es solo suyo (no cambia el de los demás).
 */
export function BarraServidor({
  servidor,
  canales,
  canalId,
  vista,
  permisos,
  cantidadMiembros,
  acciones,
  onCanal,
  onVista,
  onCrearCanal,
  onInvitar,
  onConfigurar,
}: {
  servidor: Servidor
  canales: Canal[] | undefined
  canalId: number | undefined
  vista: VistaServidor | null
  permisos: Permisos
  cantidadMiembros?: number
  /** Botones extra a la derecha (buscar, multimedia, miembros...). */
  acciones?: React.ReactNode
  onCanal: (id: number) => void
  onVista: (v: VistaServidor) => void
  onCrearCanal: () => void
  onInvitar: () => void
  onConfigurar: () => void
}) {
  const toast = useToast()
  const [ordenando, setOrdenando] = useState(false)
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const { data: membresia, mutate } = useSWR(['mi-membresia', servidor.id], () => getMiMembresia(servidor.id))

  const porDefecto: Item[] = [
    { tipo: 'resumen', id: 'resumen' },
    ...(canales ?? []).filter((c) => c.tipo === 'texto').map((c) => ({ tipo: 'canal' as const, id: c.id, canal: c })),
    ...(canales ?? []).filter((c) => c.tipo === 'voz').map((c) => ({ tipo: 'canal' as const, id: c.id, canal: c })),
    ...HERRAMIENTAS.map((h) => ({ tipo: 'herramienta' as const, id: h.id })),
  ]
  const items = ordenar(porDefecto, membresia?.orden_secciones)
  const personalizado = !!membresia?.orden_secciones?.length

  async function guardarOrden(nuevos: Item[] | null) {
    const orden = nuevos ? nuevos.map(claveDe) : []
    try {
      await mutate(ordenarMisSecciones(servidor.id, orden), {
        optimisticData: membresia && { ...membresia, orden_secciones: orden.length ? orden : null },
        rollbackOnError: true,
        revalidate: false,
      })
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  function mover(desde: number, hasta: number) {
    if (hasta < 0 || hasta >= items.length || desde === hasta) return
    const nuevos = [...items]
    const [movido] = nuevos.splice(desde, 1)
    nuevos.splice(hasta, 0, movido)
    guardarOrden(nuevos)
  }

  const botonIcono =
    'flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground'

  function renderItem(item: Item) {
    if (item.tipo === 'resumen') {
      const activo = vista === 'resumen'
      return (
        <button type="button" onClick={() => onVista('resumen')} aria-current={activo ? 'page' : undefined} className={pastilla(activo)}>
          <LayoutDashboard className="size-4" aria-hidden />
          Resumen
        </button>
      )
    }
    if (item.tipo === 'canal') {
      const c = item.canal
      const activo = vista === null && c.id === canalId
      if (c.tipo === 'voz') return <PastillaSala canal={c} activo={activo} onClick={() => onCanal(c.id)} />
      return (
        <button type="button" onClick={() => onCanal(c.id)} aria-current={activo ? 'page' : undefined} className={pastilla(activo)}>
          <MessageCircle className="size-4" aria-hidden />
          {c.nombre}
          {c.solo_lectura && <Lock className="size-3 opacity-70" aria-label="Solo lectura" />}
        </button>
      )
    }
    const h = HERRAMIENTAS.find((x) => x.id === item.id)!
    const activo = vista === h.id
    return (
      <button type="button" onClick={() => onVista(h.id)} aria-current={activo ? 'page' : undefined} className={pastilla(activo)}>
        <h.Icono className="size-4" aria-hidden />
        {h.nombre}
      </button>
    )
  }

  const nombreDe = (item: Item) =>
    item.tipo === 'resumen' ? 'Resumen' : item.tipo === 'canal' ? item.canal.nombre : HERRAMIENTAS.find((x) => x.id === item.id)!.nombre

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 pt-3 pb-2">
      <div className="flex items-center gap-3">
        <Avatar nombre={servidor.nombre} tamanio="lg" className="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold tracking-tight">{servidor.nombre}</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {cantidadMiembros !== undefined && `${cantidadMiembros} ${cantidadMiembros === 1 ? 'miembro' : 'miembros'}`}
            {servidor.expira_en && (
              <span className="flex items-center gap-1 text-primary">
                <Hourglass className="size-3" aria-hidden />
                {tiempoRestante(servidor.expira_en)}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {acciones}
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
          {permisos.puedeInvitar && (
            <button type="button" onClick={onInvitar} className={botonIcono} aria-label="Invitar gente" title="Invitar gente">
              <UserPlus className="size-4" />
            </button>
          )}
          <button type="button" onClick={onConfigurar} className={botonIcono} aria-label="Configuración del servidor" title="Configuración del servidor">
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Carril etiqueta="pestañas" className="flex-1">
          {items.map((item, i) => (
            <div
              key={claveDe(item)}
              draggable={ordenando}
              onDragStart={(e) => {
                setArrastrando(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => ordenando && arrastrando !== null && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (arrastrando !== null) mover(arrastrando, i)
                setArrastrando(null)
              }}
              onDragEnd={() => setArrastrando(null)}
              className={cn(
                'flex shrink-0 items-center',
                ordenando && 'cursor-grab rounded-full border border-dashed border-primary/50 p-0.5',
                arrastrando === i && 'opacity-40',
              )}
            >
              {ordenando && (
                <button
                  type="button"
                  onClick={() => mover(i, i - 1)}
                  disabled={i === 0}
                  className="rounded-full p-1 text-muted-foreground hover:text-primary disabled:opacity-25"
                  aria-label={`Mover ${nombreDe(item)} a la izquierda`}
                >
                  <ChevronLeft className="size-3.5" />
                </button>
              )}
              <div className={cn(ordenando && 'pointer-events-none')}>{renderItem(item)}</div>
              {ordenando && (
                <button
                  type="button"
                  onClick={() => mover(i, i + 1)}
                  disabled={i === items.length - 1}
                  className="rounded-full p-1 text-muted-foreground hover:text-primary disabled:opacity-25"
                  aria-label={`Mover ${nombreDe(item)} a la derecha`}
                >
                  <ChevronRight className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {permisos.esModerador && !ordenando && (
            <button
              type="button"
              onClick={onCrearCanal}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
              aria-label="Crear canal"
              title="Crear canal"
            >
              <Plus className="size-4" />
            </button>
          )}
        </Carril>

        <div className="flex shrink-0 items-center gap-1">
          {ordenando && personalizado && (
            <button
              type="button"
              onClick={() => guardarOrden(null)}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground"
              title="Volver al orden original"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Original</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOrdenando((v) => !v)}
            aria-pressed={ordenando}
            title={ordenando ? 'Terminar de ordenar' : 'Ordenar las pestañas a tu gusto (solo para vos)'}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
              ordenando ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
            )}
          >
            {ordenando ? <Check className="size-3.5" aria-hidden /> : <ArrowLeftRight className="size-3.5" aria-hidden />}
            <span className="hidden sm:inline">{ordenando ? 'Listo' : 'Ordenar'}</span>
          </button>
        </div>
      </div>
      {ordenando && (
        <p className="px-1 text-xs text-muted-foreground">
          Arrastrá las pestañas o usá las flechitas. Este orden es solo tuyo: los demás siguen viendo el suyo.
        </p>
      )}
    </div>
  )
}
