'use client'

import useSWR from 'swr'
import {
  AudioLines,
  CalendarDays,
  Hourglass,
  LayoutDashboard,
  ListTodo,
  Lock,
  MessageCircle,
  Newspaper,
  Plus,
  Settings,
  Trophy,
  UserPlus,
} from 'lucide-react'
import { getParticipantesVoz, type Canal, type Servidor } from '@/lib/api'
import type { Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { tiempoRestante } from './server-selector'
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
  const texto = canales?.filter((c) => c.tipo === 'texto') ?? []
  const voz = canales?.filter((c) => c.tipo === 'voz') ?? []
  const botonIcono =
    'flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground'

  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 pt-3 pb-3">
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

      <nav
        aria-label={`Secciones de ${servidor.nombre}`}
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 [mask-image:linear-gradient(to_right,black_92%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button type="button" onClick={() => onVista('resumen')} aria-current={vista === 'resumen' ? 'page' : undefined} className={pastilla(vista === 'resumen')}>
          <LayoutDashboard className="size-4" aria-hidden />
          Resumen
        </button>
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
        {texto.map((c) => {
          const activo = vista === null && c.id === canalId
          return (
            <button key={c.id} type="button" onClick={() => onCanal(c.id)} aria-current={activo ? 'page' : undefined} className={pastilla(activo)}>
              <MessageCircle className="size-4" aria-hidden />
              {c.nombre}
              {c.solo_lectura && <Lock className="size-3 opacity-70" aria-label="Solo lectura" />}
            </button>
          )
        })}
        {voz.map((c) => (
          <PastillaSala key={c.id} canal={c} activo={vista === null && c.id === canalId} onClick={() => onCanal(c.id)} />
        ))}
        {permisos.esModerador && (
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
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
        {HERRAMIENTAS.map(({ id, nombre, Icono }) => (
          <button key={id} type="button" onClick={() => onVista(id)} aria-current={vista === id ? 'page' : undefined} className={pastilla(vista === id)}>
            <Icono className="size-4" aria-hidden />
            {nombre}
          </button>
        ))}
      </nav>
    </div>
  )
}
