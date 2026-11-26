'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { CircleAlert, Lock } from 'lucide-react'
import {
  borrarMensajeDirecto,
  directoComoMensaje,
  editarMensajeDirecto,
  enviarMensaje,
  enviarMensajeDirecto,
  getMensajes,
  getMensajesDirectos,
  mensajeDeError,
  type Adjunto,
  type Canal,
  type Mensaje,
  type Usuario,
  type UsuarioResumen,
} from '@/lib/api'
import { parseFecha } from '@/lib/kort'
import type { Permisos } from '@/lib/kort'
import { useToast } from './toast-provider'
import { Composer } from './composer'
import { CrearEncuestaModal } from './encuesta-modal'
import { MessageItem } from './message-item'
import { Avatar, Boton } from './ui'

const LIMITE = 50
const AGRUPAR_MS = 5 * 60 * 1000

function combinar(base: Map<number, Mensaje>, recientes: Mensaje[]): Map<number, Mensaje> {
  const res = new Map(base)
  if (recientes.length === 0) {
    res.clear()
    return res
  }
  const minId = recientes[0].id
  const ids = new Set(recientes.map((m) => m.id))
  for (const id of res.keys()) if (id >= minId && !ids.has(id)) res.delete(id)
  for (const m of recientes) res.set(m.id, m)
  return res
}

/**
 * Vista de chat genérica: la usan los canales de texto y los mensajes directos.
 * Pide los mensajes nuevos cada 3 segundos y permite cargar los anteriores.
 */
function ChatVista({
  claveSWR,
  cargar,
  yo,
  encabezadoVacio,
  puedeEscribir,
  avisoSinPermiso,
  destino,
  enviar,
  onEncuesta,
  itemProps,
  extra,
}: {
  claveSWR: unknown[]
  cargar: (opciones: { limite: number; antes_de?: number }) => Promise<Mensaje[]>
  yo: Usuario
  encabezadoVacio: React.ReactNode
  puedeEscribir: boolean
  avisoSinPermiso: string
  destino: string
  enviar: (contenido: string, adjunto: Adjunto | null) => Promise<Mensaje>
  onEncuesta?: () => void
  itemProps: (m: Mensaje) => Partial<React.ComponentProps<typeof MessageItem>>
  /** Para recibir la función que agrega un mensaje (lo usa el modal de encuestas). */
  extra?: (agregar: (m: Mensaje) => void) => React.ReactNode
}) {
  const toast = useToast()
  const [vistos, setVistos] = useState<Map<number, Mensaje>>(() => new Map())
  const [hayAnteriores, setHayAnteriores] = useState<boolean | null>(null)
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cercaDelFondo = useRef(true)
  const forzarFondo = useRef(true)
  const alturaPrevia = useRef<number | null>(null)

  const {
    data: recientes,
    error,
    isLoading,
    mutate,
  } = useSWR(claveSWR, () => cargar({ limite: LIMITE }), {
    refreshInterval: 3000,
    onError: () => {},
    onSuccess: (data) => setVistos((prev) => combinar(prev, data)),
  })

  const mensajes = useMemo(() => {
    const mapa = recientes ? combinar(vistos, recientes) : vistos
    return [...mapa.values()].sort((a, b) => a.id - b.id)
  }, [vistos, recientes])

  const mostrarCargarMas = hayAnteriores ?? (recientes?.length ?? 0) >= LIMITE
  const ultimoId = mensajes.at(-1)?.id
  const primerId = mensajes[0]?.id

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (alturaPrevia.current !== null) {
      el.scrollTop = el.scrollHeight - alturaPrevia.current
      alturaPrevia.current = null
      return
    }
    if (forzarFondo.current || cercaDelFondo.current) {
      el.scrollTop = el.scrollHeight
      if (ultimoId !== undefined) forzarFondo.current = false
    }
  }, [ultimoId, primerId])

  async function cargarAnteriores() {
    if (primerId === undefined) return
    setCargandoAnteriores(true)
    try {
      const viejos = await cargar({ limite: LIMITE, antes_de: primerId })
      const el = scrollRef.current
      if (el) alturaPrevia.current = el.scrollHeight - el.scrollTop
      setVistos((prev) => {
        const res = new Map(prev)
        for (const m of viejos) res.set(m.id, m)
        return res
      })
      setHayAnteriores(viejos.length >= LIMITE)
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setCargandoAnteriores(false)
    }
  }

  function alEnviar(m: Mensaje) {
    forzarFondo.current = true
    setVistos((prev) => new Map(prev).set(m.id, m))
    mutate((cur) => (cur ? [...cur.filter((x) => x.id !== m.id), m] : [m]), { revalidate: true })
  }

  function alEditar(m: Mensaje) {
    setVistos((prev) => (prev.has(m.id) ? new Map(prev).set(m.id, m) : prev))
    mutate((cur) => cur?.map((x) => (x.id === m.id ? m : x)), { revalidate: true })
  }

  function alBorrar(id: number) {
    setVistos((prev) => {
      const res = new Map(prev)
      res.delete(id)
      return res
    })
    mutate((cur) => cur?.filter((x) => x.id !== id), { revalidate: true })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          cercaDelFondo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
        className="fondo-puntos scrollbar-thin min-h-0 flex-1 overflow-y-auto py-4"
      >
        {mostrarCargarMas && (
          <div className="flex justify-center pb-2">
            <Boton variante="secundario" onClick={cargarAnteriores} cargando={cargandoAnteriores} className="h-8 text-xs">
              Cargar mensajes anteriores
            </Boton>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-2 mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{mensajeDeError(error)}</span>
          </div>
        )}

        {isLoading && mensajes.length === 0 ? (
          <ul className="flex flex-col gap-4 px-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex gap-3">
                <span className="size-9 animate-pulse rounded-lg bg-elevated" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="h-3 w-28 animate-pulse rounded bg-elevated" />
                  <span className="h-3 w-2/3 animate-pulse rounded bg-elevated/70" />
                </span>
              </li>
            ))}
          </ul>
        ) : mensajes.length === 0 && !error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">{encabezadoVacio}</div>
        ) : (
          <ul className="flex flex-col" aria-label={`Mensajes con ${destino}`}>
            {mensajes.map((m, i) => {
              const anterior = mensajes[i - 1]
              const agrupado =
                !!anterior &&
                anterior.autor_id === m.autor_id &&
                parseFecha(m.fecha).getTime() - parseFecha(anterior.fecha).getTime() < AGRUPAR_MS
              const propio = m.autor_id === yo.id
              return (
                <MessageItem
                  key={m.id}
                  mensaje={m}
                  agrupado={agrupado}
                  miId={yo.id}
                  puedeEditar={propio}
                  puedeBorrar={propio}
                  onEditado={alEditar}
                  onBorrado={alBorrar}
                  {...itemProps(m)}
                />
              )
            })}
          </ul>
        )}
      </div>

      {puedeEscribir ? (
        <Composer destino={destino} onEnviar={enviar} onEnviado={alEnviar} onEncuesta={onEncuesta} />
      ) : (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" aria-hidden />
            {avisoSinPermiso}
          </div>
        </div>
      )}
      {extra?.(alEnviar)}
    </div>
  )
}

/** Chat de un canal de texto de un servidor. */
export function ChatPanel({
  canal,
  yo,
  permisos,
  onVerPerfil,
}: {
  canal: Canal
  yo: Usuario
  permisos: Permisos
  onVerPerfil?: (usuarioId: number) => void
}) {
  const [creandoEncuesta, setCreandoEncuesta] = useState(false)
  // Igual que en el backend (HU7): hace falta un rol con puede_escribir y,
  // si el canal es de solo lectura, además ser dueño o moderador.
  const puedeEscribir = permisos.puedeEscribir && (!canal.solo_lectura || permisos.esModerador)

  return (
    <ChatVista
      claveSWR={['mensajes', canal.id]}
      cargar={(o) => getMensajes(canal.id, o)}
      yo={yo}
      destino={canal.nombre}
      encabezadoVacio={
        <>
          <p className="font-display text-2xl font-extrabold">Así empieza {canal.nombre}</p>
          <p className="text-sm text-muted-foreground">
            {puedeEscribir ? 'Todavía no hay mensajes. ¡Rompé el hielo!' : 'Todavía no hay mensajes.'}
          </p>
        </>
      }
      puedeEscribir={puedeEscribir}
      avisoSinPermiso={canal.solo_lectura ? 'Este canal es de solo lectura' : 'No tenés permiso para escribir'}
      enviar={(contenido, adjunto) => enviarMensaje(canal.id, contenido, adjunto)}
      onEncuesta={() => setCreandoEncuesta(true)}
      itemProps={(m) => ({
        // Igual que el backend: el autor o un moderador (HU8).
        puedeBorrar: m.autor_id === yo.id || permisos.esModerador,
        puedeFijar: permisos.esModerador,
        onVerPerfil,
      })}
      extra={(agregar) => (
        <CrearEncuestaModal
          abierto={creandoEncuesta}
          canalId={canal.id}
          onCerrar={() => setCreandoEncuesta(false)}
          onCreada={agregar}
        />
      )}
    />
  )
}

/** Chat privado con otro usuario. */
export function DirectoPanel({
  usuario,
  yo,
  onVerPerfil,
}: {
  usuario: UsuarioResumen
  yo: Usuario
  onVerPerfil?: (usuarioId: number) => void
}) {
  return (
    <ChatVista
      claveSWR={['directos', usuario.id]}
      cargar={async (o) => (await getMensajesDirectos(usuario.id, o)).map(directoComoMensaje)}
      yo={yo}
      destino={`@${usuario.username}`}
      encabezadoVacio={
        <>
          <Avatar nombre={usuario.username} url={usuario.avatar_url} tamanio="xl" />
          <p className="mt-2 text-lg font-semibold">{usuario.username}</p>
          <p className="text-sm text-muted-foreground">
            Este es el comienzo de tu conversación con {usuario.username}.
          </p>
        </>
      }
      puedeEscribir
      avisoSinPermiso=""
      enviar={async (contenido, adjunto) => directoComoMensaje(await enviarMensajeDirecto(usuario.id, contenido, adjunto))}
      itemProps={() => ({
        puedeReaccionar: false,
        onVerPerfil,
        editar: async (id, contenido) => directoComoMensaje(await editarMensajeDirecto(id, contenido)),
        borrar: borrarMensajeDirecto,
      })}
    />
  )
}
