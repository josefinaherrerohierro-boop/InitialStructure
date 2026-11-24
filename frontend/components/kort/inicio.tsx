'use client'

/**
 * "Inicio": todo lo que no pertenece a un servidor.
 * Amigos, mensajes directos y publicaciones.
 */

import { useState } from 'react'
import useSWR from 'swr'
import { Check, MessageCircle, Newspaper, Sparkles, UserPlus, Users, X } from 'lucide-react'
import {
  aceptarSolicitud,
  enviarSolicitud,
  getAmigos,
  getConversaciones,
  getSolicitudes,
  mensajeDeError,
  rechazarSolicitud,
  type UsuarioResumen,
} from '@/lib/api'
import { horaMensaje } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { useToast } from './toast-provider'
import { Avatar, Boton, ErrorFormulario, Input } from './ui'

export type SeleccionInicio = { tipo: 'amigos' } | { tipo: 'feed' } | { tipo: 'dm'; usuario: UsuarioResumen }

/** Cantidad de cosas sin ver en Inicio (mensajes directos + solicitudes), para el globito. */
export function usePendientesInicio(activo: boolean): number {
  const { data: conversaciones } = useSWR(activo ? 'conversaciones' : null, getConversaciones, {
    refreshInterval: 5000,
    onError: () => {},
  })
  const { data: solicitudes } = useSWR(activo ? 'solicitudes' : null, getSolicitudes, {
    refreshInterval: 10000,
    onError: () => {},
  })
  const noLeidos = conversaciones?.reduce((total, c) => total + c.no_leidos, 0) ?? 0
  return noLeidos + (solicitudes?.recibidas.length ?? 0)
}

function Globito({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
      {n > 99 ? '99+' : n}
    </span>
  )
}

/** Barra lateral de Inicio: accesos y lista de conversaciones. */
export function InicioSidebar({
  seleccion,
  onSeleccionar,
  onWrapped,
}: {
  seleccion: SeleccionInicio
  onSeleccionar: (s: SeleccionInicio) => void
  onWrapped?: () => void
}) {
  const { data: conversaciones } = useSWR('conversaciones', getConversaciones, { refreshInterval: 5000 })
  const { data: solicitudes } = useSWR('solicitudes', getSolicitudes, { refreshInterval: 10000 })

  const item = (activo: boolean) =>
    cn(
      'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
      activo ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:bg-elevated/60 hover:text-foreground',
    )

  return (
    <section aria-label="Inicio" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={() => onSeleccionar({ tipo: 'amigos' })} className={item(seleccion.tipo === 'amigos')}>
          <Users className="size-4" aria-hidden />
          Amigos
          <Globito n={solicitudes?.recibidas.length ?? 0} />
        </button>
        <button type="button" onClick={() => onSeleccionar({ tipo: 'feed' })} className={item(seleccion.tipo === 'feed')}>
          <Newspaper className="size-4" aria-hidden />
          Publicaciones y estados
        </button>
        {onWrapped && (
          <button
            type="button"
            onClick={onWrapped}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg bg-gradient-to-r from-[#ff6b5b] via-[#d9667f] to-[#7c5cff] px-2 py-1.5 text-left text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="size-4" aria-hidden />
            Tu Kort Wrapped {new Date().getFullYear()}
          </button>
        )}
      </div>

      <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mensajes directos</h3>
      <ul className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {conversaciones?.length === 0 && (
          <li className="px-2 text-sm text-muted-foreground">Todavía no tenés conversaciones. Escribile a un amigo.</li>
        )}
        {conversaciones?.map((c) => {
          const activo = seleccion.tipo === 'dm' && seleccion.usuario.id === c.usuario.id
          const ultimo = c.ultimo_mensaje
          const vista = ultimo.contenido || (ultimo.adjunto ? `📎 ${ultimo.adjunto.tipo}` : '')
          return (
            <li key={c.usuario.id}>
              <button type="button" onClick={() => onSeleccionar({ tipo: 'dm', usuario: c.usuario })} className={item(activo)}>
                <Avatar nombre={c.usuario.username} url={c.usuario.avatar_url} tamanio="sm" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', c.no_leidos > 0 && 'font-semibold text-foreground')}>
                    {c.usuario.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{vista}</span>
                </span>
                <Globito n={c.no_leidos} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type PestaniaAmigos = 'todos' | 'pendientes' | 'agregar'

/** Pantalla de amigos: lista, solicitudes pendientes y agregar por nombre de usuario. */
export function AmigosView({
  onMensaje,
  onVerPerfil,
}: {
  onMensaje: (u: UsuarioResumen) => void
  onVerPerfil: (usuarioId: number) => void
}) {
  const toast = useToast()
  const [pestania, setPestania] = useState<PestaniaAmigos>('todos')
  const { data: amigos, mutate: mutateAmigos } = useSWR('amigos', getAmigos, { refreshInterval: 15000 })
  const { data: solicitudes, mutate: mutateSolicitudes } = useSWR('solicitudes', getSolicitudes, { refreshInterval: 10000 })
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const { estado } = await enviarSolicitud(username.trim())
      toast.exito(estado === 'amigos' ? `¡Ahora sos amigo de ${username.trim()}!` : 'Solicitud enviada.')
      setUsername('')
      mutateAmigos()
      mutateSolicitudes()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function responder(accion: () => Promise<void>, mensaje: string) {
    try {
      await accion()
      toast.exito(mensaje)
      mutateAmigos()
      mutateSolicitudes()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  const pendientes = (solicitudes?.recibidas.length ?? 0) + (solicitudes?.enviadas.length ?? 0)

  const fila = (u: UsuarioResumen, detalle: string, acciones: React.ReactNode) => (
    <li key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface">
      <button type="button" onClick={() => onVerPerfil(u.id)} aria-label={`Ver perfil de ${u.username}`}>
        <Avatar nombre={u.username} url={u.avatar_url} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{u.username}</p>
        <p className="truncate text-xs text-muted-foreground">{detalle}</p>
      </div>
      <div className="flex shrink-0 gap-1">{acciones}</div>
    </li>
  )

  const botonRedondo =
    'flex size-9 items-center justify-center rounded-full bg-elevated text-muted-foreground transition-colors hover:text-foreground'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-border px-4 py-2">
        {(
          [
            ['todos', `Todos${amigos ? ` (${amigos.length})` : ''}`],
            ['pendientes', `Pendientes${pendientes ? ` (${pendientes})` : ''}`],
            ['agregar', 'Agregar amigo'],
          ] as [PestaniaAmigos, string][]
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestania === id}
            onClick={() => setPestania(id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              id === 'agregar'
                ? pestania === id
                  ? 'bg-success/20 text-success'
                  : 'bg-success/90 text-background hover:bg-success'
                : pestania === id
                  ? 'bg-elevated font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-elevated/60 hover:text-foreground',
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-4">
        {pestania === 'agregar' && (
          <form onSubmit={agregar} className="flex flex-col gap-3">
            <h2 className="font-semibold">Agregar amigo</h2>
            <p className="text-sm text-muted-foreground">Escribí su nombre de usuario exacto.</p>
            <div className="flex gap-2">
              <Input
                autoFocus
                aria-label="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej: ana"
              />
              <Boton type="submit" cargando={enviando} disabled={!username.trim()}>
                <UserPlus className="size-4" aria-hidden />
                Enviar
              </Boton>
            </div>
            <ErrorFormulario mensaje={error} />
          </form>
        )}

        {pestania === 'todos' &&
          (amigos && amigos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Users className="size-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">Todavía no agregaste a nadie.</p>
              <Boton onClick={() => setPestania('agregar')}>Agregar amigo</Boton>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {amigos?.map((a) =>
                fila(
                  a.usuario,
                  a.usuario.bio || `Amigos desde ${horaMensaje(a.desde).replace(/ \d\d:\d\d$/, '')}`,
                  <button type="button" onClick={() => onMensaje(a.usuario)} className={botonRedondo} aria-label={`Escribirle a ${a.usuario.username}`}>
                    <MessageCircle className="size-4" />
                  </button>,
                ),
              )}
            </ul>
          ))}

        {pestania === 'pendientes' && (
          <div className="flex flex-col gap-5">
            {pendientes === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No hay solicitudes pendientes.</p>}
            {!!solicitudes?.recibidas.length && (
              <section>
                <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recibidas</h3>
                <ul>
                  {solicitudes.recibidas.map((s) =>
                    fila(s.usuario, 'Quiere ser tu amigo', (
                      <>
                        <button
                          type="button"
                          onClick={() => responder(() => aceptarSolicitud(s.id), `Ahora sos amigo de ${s.usuario.username}.`)}
                          className={cn(botonRedondo, 'hover:text-success')}
                          aria-label="Aceptar"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => responder(() => rechazarSolicitud(s.id), 'Solicitud rechazada.')}
                          className={cn(botonRedondo, 'hover:text-destructive')}
                          aria-label="Rechazar"
                        >
                          <X className="size-4" />
                        </button>
                      </>
                    )),
                  )}
                </ul>
              </section>
            )}
            {!!solicitudes?.enviadas.length && (
              <section>
                <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enviadas</h3>
                <ul>
                  {solicitudes.enviadas.map((s) =>
                    fila(s.usuario, 'Esperando respuesta', (
                      <button
                        type="button"
                        onClick={() => responder(() => rechazarSolicitud(s.id), 'Solicitud cancelada.')}
                        className={cn(botonRedondo, 'hover:text-destructive')}
                        aria-label="Cancelar solicitud"
                      >
                        <X className="size-4" />
                      </button>
                    )),
                  )}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
