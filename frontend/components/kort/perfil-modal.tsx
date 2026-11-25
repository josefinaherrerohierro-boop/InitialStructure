'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  AtSign,
  Briefcase,
  Camera,
  ChevronLeft,
  ChevronRight,
  Code2,
  Gamepad2,
  Globe,
  MessageCircle,
  Music2,
  Play,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import {
  aceptarSolicitud,
  eliminarAmigo,
  enviarSolicitud,
  getPerfil,
  getSolicitudes,
  mensajeDeError,
  rechazarSolicitud,
  urlArchivo,
  type Perfil,
  type UsuarioResumen,
} from '@/lib/api'
import { colorDesdeNombre, parseFecha } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Modal } from './modal'
import { useToast } from './toast-provider'
import { Avatar, Boton } from './ui'

export const REDES: Record<string, { nombre: string; color: string; Icono: typeof Globe }> = {
  instagram: { nombre: 'Instagram', color: '#E1306C', Icono: Camera },
  x: { nombre: 'X', color: '#9AA0A6', Icono: AtSign },
  tiktok: { nombre: 'TikTok', color: '#25F4EE', Icono: Music2 },
  youtube: { nombre: 'YouTube', color: '#FF0033', Icono: Play },
  twitch: { nombre: 'Twitch', color: '#9146FF', Icono: Gamepad2 },
  github: { nombre: 'GitHub', color: '#C9D1D9', Icono: Code2 },
  spotify: { nombre: 'Spotify', color: '#1DB954', Icono: Music2 },
  linkedin: { nombre: 'LinkedIn', color: '#0A66C2', Icono: Briefcase },
  web: { nombre: 'Web', color: '#FF6B5B', Icono: Globe },
}

const formatoFecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Fotos de perfil: se pasan con las flechas (como un carrusel). */
function CarruselFotos({ perfil }: { perfil: Perfil }) {
  const [indice, setIndice] = useState(0)
  const fotos = perfil.fotos
  if (fotos.length === 0) return <Avatar nombre={perfil.username} tamanio="xl" className="ring-4 ring-surface" />
  const foto = fotos[Math.min(indice, fotos.length - 1)]
  return (
    <div className="group/foto relative size-24 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urlArchivo(foto.url)}
        alt={`Foto ${indice + 1} de ${perfil.username}`}
        className="size-24 rounded-2xl object-cover ring-4 ring-surface"
      />
      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndice((i) => (i - 1 + fotos.length) % fotos.length)}
            className="absolute top-1/2 -left-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setIndice((i) => (i + 1) % fotos.length)}
            className="absolute top-1/2 -right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white"
            aria-label="Foto siguiente"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="absolute inset-x-0 -bottom-3 flex justify-center gap-1" aria-hidden>
            {fotos.map((f, i) => (
              <span key={f.id} className={cn('size-1.5 rounded-full', i === indice ? 'bg-primary' : 'bg-border')} />
            ))}
          </span>
        </>
      )}
    </div>
  )
}

/** Botones según la relación de amistad con esa persona. */
function AccionesAmistad({ perfil, onCambio }: { perfil: Perfil; onCambio: () => void }) {
  const toast = useToast()
  const [ocupado, setOcupado] = useState(false)
  const { data: solicitudes } = useSWR(perfil.relacion === 'recibida' || perfil.relacion === 'enviada' ? 'solicitudes' : null, getSolicitudes)

  async function hacer(accion: () => Promise<unknown>, mensaje: string) {
    setOcupado(true)
    try {
      await accion()
      toast.exito(mensaje)
      onCambio()
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  const solicitud = [...(solicitudes?.recibidas ?? []), ...(solicitudes?.enviadas ?? [])].find(
    (s) => s.usuario.id === perfil.id,
  )

  switch (perfil.relacion) {
    case 'ninguna':
      return (
        <Boton cargando={ocupado} onClick={() => hacer(() => enviarSolicitud(perfil.username), 'Solicitud enviada.')}>
          <UserPlus className="size-4" aria-hidden />
          Agregar amigo
        </Boton>
      )
    case 'enviada':
      return (
        <Boton
          variante="secundario"
          cargando={ocupado}
          disabled={!solicitud}
          onClick={() => solicitud && hacer(() => rechazarSolicitud(solicitud.id), 'Cancelaste la solicitud.')}
        >
          Cancelar solicitud
        </Boton>
      )
    case 'recibida':
      return (
        <Boton
          cargando={ocupado}
          disabled={!solicitud}
          onClick={() => solicitud && hacer(() => aceptarSolicitud(solicitud.id), `Ahora sos amigo de ${perfil.username}.`)}
        >
          <UserCheck className="size-4" aria-hidden />
          Aceptar solicitud
        </Boton>
      )
    case 'amigos':
      return (
        <Boton
          variante="fantasma"
          cargando={ocupado}
          onClick={() => hacer(() => eliminarAmigo(perfil.id), `Ya no sos amigo de ${perfil.username}.`)}
        >
          <UserMinus className="size-4" aria-hidden />
          Eliminar amigo
        </Boton>
      )
    default:
      return null
  }
}

export function PerfilModal({
  usuarioId,
  onCerrar,
  onMensaje,
  extra,
}: {
  usuarioId: number | null
  onCerrar: () => void
  onMensaje?: (u: UsuarioResumen) => void
  /** Contenido extra debajo del perfil (por ejemplo, sus publicaciones). */
  extra?: (perfil: Perfil) => React.ReactNode
}) {
  const { data: perfil, error, mutate } = useSWR(usuarioId ? ['perfil', usuarioId] : null, () => getPerfil(usuarioId!))
  const color = perfil ? colorDesdeNombre(perfil.username) : '#2e3240'

  return (
    <Modal abierto={usuarioId !== null} onCerrar={onCerrar} titulo={perfil ? `Perfil de ${perfil.username}` : 'Perfil'}>
      {error ? (
        <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
      ) : !perfil ? (
        <div className="h-48 animate-pulse rounded-xl bg-elevated" aria-hidden />
      ) : (
        <div className="-mx-6 -mb-6 flex flex-col">
          <div className="h-20" style={{ background: `linear-gradient(135deg, ${color}66, ${color}22)` }} />
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="-mt-12 flex items-end justify-between gap-3">
              <CarruselFotos perfil={perfil} />
              <div className="flex flex-wrap justify-end gap-2 pb-1">
                {perfil.relacion !== 'yo' && onMensaje && (
                  <Boton variante="secundario" onClick={() => onMensaje(perfil)}>
                    <MessageCircle className="size-4" aria-hidden />
                    Mensaje
                  </Boton>
                )}
                <AccionesAmistad perfil={perfil} onCambio={() => mutate()} />
              </div>
            </div>

            <div>
              <p className="text-xl font-semibold">{perfil.username}</p>
              <p className="text-xs text-muted-foreground">
                En Kort desde el {formatoFecha.format(parseFecha(perfil.fecha_registro))}
                {perfil.servidores_en_comun > 0 &&
                  ` · ${perfil.servidores_en_comun} ${perfil.servidores_en_comun === 1 ? 'servidor' : 'servidores'} en común`}
                {perfil.relacion === 'amigos' && ' · Amigos'}
              </p>
            </div>

            {perfil.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed">{perfil.bio}</p>}

            {perfil.etiquetas.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
                {perfil.etiquetas.map((e) => (
                  <li key={e} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {e}
                  </li>
                ))}
              </ul>
            )}

            {perfil.redes.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Redes sociales</p>
                <ul className="flex flex-wrap gap-2">
                  {perfil.redes.map((r) => {
                    const info = REDES[r.red] ?? REDES.web
                    return (
                      <li key={r.red}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium hover:border-primary/40"
                        >
                          <info.Icono className="size-3.5" style={{ color: info.color }} aria-hidden />
                          {info.nombre}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {extra?.(perfil)}
          </div>
        </div>
      )}
    </Modal>
  )
}

