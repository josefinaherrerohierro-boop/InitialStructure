'use client'

import useSWR from 'swr'
import { ArrowRight, AudioLines, CalendarDays, Crown, ListTodo, MessageCircle, Newspaper, Trophy } from 'lucide-react'
import {
  getEventos,
  getParticipantesVoz,
  getPublicacionesDeServidor,
  getScoreboard,
  getTareas,
  type Canal,
  type Servidor,
  type Usuario,
} from '@/lib/api'
import { horaMensaje, parseFecha } from '@/lib/kort'
import { cn } from '@/lib/utils'
import type { VistaServidor } from './barra-servidor'
import { aInputFecha } from './encuesta-modal'
import { Avatar } from './ui'

const saludo = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

function Tarjeta({
  titulo,
  Icono,
  color,
  onVer,
  children,
  className,
}: {
  titulo: string
  Icono: typeof Trophy
  color: string
  onVer?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-3xl border border-border bg-background/60 p-5', className)}>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex size-8 items-center justify-center rounded-xl', color)}>
          <Icono className="size-4" aria-hidden />
        </span>
        <h2 className="flex-1 font-display text-base font-bold">{titulo}</h2>
        {onVer && (
          <button type="button" onClick={onVer} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary">
            Ver todo
            <ArrowRight className="size-3" aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

const Vacio = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

/** Sala de voz con gente adentro (para la tarjeta "En llamada ahora"). */
function SalaEnVivo({ canal, onEntrar }: { canal: Canal; onEntrar: () => void }) {
  const { data } = useSWR(['voz', canal.id], () => getParticipantesVoz(canal.id), { refreshInterval: 3000, onError: () => {} })
  if (!data || data.length === 0) return null
  return (
    <button type="button" onClick={onEntrar} className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 p-3 text-left hover:bg-success/15">
      <AudioLines className="size-5 text-success" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{canal.nombre}</span>
        <span className="block truncate text-xs text-muted-foreground">{data.map((p) => p.username).join(', ')}</span>
      </span>
      <span className="flex -space-x-2">
        {data.slice(0, 4).map((p) => (
          <Avatar key={p.usuario_id} nombre={p.username} tamanio="sm" className="rounded-full ring-2 ring-surface" />
        ))}
      </span>
    </button>
  )
}

/**
 * Pantalla de entrada de cada servidor: lo importante de un vistazo
 * (eventos, tus tareas, quién está en llamada, publicaciones y el podio).
 */
export function ResumenServidor({
  servidor,
  canales,
  yo,
  onVista,
  onCanal,
  onVerPerfil,
}: {
  servidor: Servidor
  canales: Canal[]
  yo: Usuario
  onVista: (v: VistaServidor) => void
  onCanal: (id: number) => void
  onVerPerfil: (id: number) => void
}) {
  const ahora = new Date()
  const desde = aInputFecha(ahora) + ':00'
  const hasta = aInputFecha(new Date(ahora.getTime() + 45 * 24 * 3600 * 1000)) + ':00'
  const { data: eventos } = useSWR(['resumen-eventos', servidor.id], () => getEventos(servidor.id, desde, hasta))
  const { data: tareas } = useSWR(['tareas', servidor.id, true], () => getTareas(servidor.id, true))
  const { data: publicaciones } = useSWR(['resumen-publicaciones', servidor.id], () => getPublicacionesDeServidor(servidor.id))
  const { data: tabla } = useSWR(['scoreboard', servidor.id], () => getScoreboard(servidor.id))

  const salas = canales.filter((c) => c.tipo === 'voz')
  const textos = canales.filter((c) => c.tipo === 'texto')
  const pendientes = (tareas ?? []).filter((t) => t.estado !== 'hecha')

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {saludo()}, {yo.username} 👋
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Esto está pasando en {servidor.nombre}</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {textos.slice(0, 4).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCanal(c.id)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                <MessageCircle className="size-3.5" aria-hidden />
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Tarjeta titulo="Próximos eventos" Icono={CalendarDays} color="bg-primary/15 text-primary" onVer={() => onVista('calendario')}>
            {!eventos ? (
              <div className="h-16 animate-pulse rounded-xl bg-elevated" />
            ) : eventos.length === 0 ? (
              <Vacio>No hay nada agendado. Creá el primer evento desde el calendario.</Vacio>
            ) : (
              <ul className="flex flex-col gap-2">
                {eventos.slice(0, 4).map((e) => {
                  const d = parseFecha(e.inicio)
                  return (
                    <li key={e.id} className="flex items-center gap-3">
                      <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-surface py-1 shadow-[var(--sombra)]">
                        <span className="text-[10px] uppercase text-primary">{d.toLocaleDateString('es-AR', { month: 'short' })}</span>
                        <span className="font-display text-lg leading-none font-bold">{d.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.titulo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {e.asistentes.length}{' '}
                          {e.asistentes.length === 1 ? 'va' : 'van'}
                          {e.voy && ' · vos también'}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Tus tareas" Icono={ListTodo} color="bg-warning/15 text-warning" onVer={() => onVista('tareas')}>
            {!tareas ? (
              <div className="h-16 animate-pulse rounded-xl bg-elevated" />
            ) : pendientes.length === 0 ? (
              <Vacio>No tenés tareas pendientes. 🎉</Vacio>
            ) : (
              <ul className="flex flex-col gap-2">
                {pendientes.slice(0, 4).map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 text-sm">
                    <span className={cn('size-2.5 shrink-0 rounded-full', t.estado === 'en_progreso' ? 'bg-warning' : 'border-2 border-muted-foreground/50')} />
                    <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                    {t.fecha_limite && (
                      <span className={cn('shrink-0 text-xs', t.vencida ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {t.vencida ? 'vencida' : horaMensaje(t.fecha_limite).replace(/ \d\d:\d\d.*$/, '')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="En llamada ahora" Icono={AudioLines} color="bg-success/15 text-success">
            {salas.length === 0 ? (
              <Vacio>Este servidor no tiene salas de voz.</Vacio>
            ) : (
              <div className="flex flex-col gap-2">
                {salas.map((c) => (
                  <SalaEnVivo key={c.id} canal={c} onEntrar={() => onCanal(c.id)} />
                ))}
                <p className="text-xs text-muted-foreground">
                  Salas: {salas.map((c) => c.nombre).join(', ')}. Si no hay nadie, ¡arrancá vos!
                </p>
              </div>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Últimas publicaciones"
            Icono={Newspaper}
            color="bg-[#3d6fd9]/15 text-[#3d6fd9]"
            onVer={() => onVista('publicaciones')}
            className="md:col-span-2"
          >
            {!publicaciones ? (
              <div className="h-16 animate-pulse rounded-xl bg-elevated" />
            ) : publicaciones.length === 0 ? (
              <Vacio>Nadie publicó nada todavía.</Vacio>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {publicaciones.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex gap-2.5 rounded-2xl bg-surface p-3 shadow-[var(--sombra)]">
                    <button type="button" onClick={() => onVerPerfil(p.autor.id)} aria-label={`Ver perfil de ${p.autor.username}`}>
                      <Avatar nombre={p.autor.username} url={p.autor.avatar_url} tamanio="sm" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs">
                        <span className="font-semibold">{p.autor.username}</span>{' '}
                        <span className="text-muted-foreground">{horaMensaje(p.fecha)}</span>
                      </p>
                      <p className="line-clamp-2 text-sm">{p.contenido || '📷 Imagen'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Podio" Icono={Trophy} color="bg-warning/15 text-warning" onVer={() => onVista('scoreboard')}>
            {!tabla ? (
              <div className="h-16 animate-pulse rounded-xl bg-elevated" />
            ) : (
              <ol className="flex flex-col gap-2">
                {tabla.slice(0, 3).map((p) => (
                  <li key={p.usuario.id} className="flex items-center gap-2.5 text-sm">
                    <span className="w-5 text-center font-display font-bold text-muted-foreground">{p.posicion}</span>
                    <Avatar nombre={p.usuario.username} url={p.usuario.avatar_url} tamanio="sm" />
                    <span className="min-w-0 flex-1 truncate">{p.apodo || p.usuario.username}</span>
                    {p.posicion === 1 && <Crown className="size-3.5 text-warning" aria-hidden />}
                    <span className="font-display font-bold tabular-nums">{p.puntos}</span>
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
