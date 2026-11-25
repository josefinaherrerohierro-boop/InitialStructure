'use client'

import { useRef, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import { Heart, ImagePlus, Megaphone, MessageCircle, Send, Trash2, X } from 'lucide-react'
import useSWR from 'swr'
import {
  alternarMeGusta,
  borrarComentario,
  borrarPublicacion,
  comentar,
  crearPublicacion,
  getComentarios,
  mensajeDeError,
  subirArchivo,
  urlArchivo,
  type Publicacion,
  type Usuario,
} from '@/lib/api'
import { horaMensaje } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { ElegirServidorFlyer, TarjetaFlyer } from './flyer'
import { TextoConLinks } from './texto-enriquecido'
import { useToast } from './toast-provider'
import { Avatar, Boton } from './ui'

const POR_PAGINA = 20

/** Caja para escribir una publicación (texto y/o una imagen). */
function NuevaPublicacion({
  yo,
  servidorId,
  onCreada,
}: {
  yo: Usuario
  servidorId?: number
  onCreada: (p: Publicacion) => void
}) {
  const toast = useToast()
  const [texto, setTexto] = useState('')
  const [imagen, setImagen] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [conFlyer, setConFlyer] = useState(false)
  const [promocionar, setPromocionar] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() && !imagen && !promocionar) return
    setPublicando(true)
    try {
      onCreada(
        await crearPublicacion({
          contenido: texto.trim(),
          imagen_url: imagen,
          servidor_id: servidorId ?? null,
          promocionar_servidor_id: promocionar,
        }),
      )
      setTexto('')
      setImagen(null)
      setPromocionar(null)
      setConFlyer(false)
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setPublicando(false)
    }
  }

  return (
    <form onSubmit={publicar} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
      <Avatar nombre={yo.username} url={yo.avatar_url} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <label htmlFor="nueva-publicacion" className="sr-only">
          Nueva publicación
        </label>
        <textarea
          id="nueva-publicacion"
          value={texto}
          maxLength={2000}
          rows={Math.min(6, Math.max(2, texto.split('\n').length))}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={servidorId ? 'Compartí algo con el servidor…' : '¿Qué estás pensando? Lo ve todo Kort.'}
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        {imagen && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlArchivo(imagen)} alt="" className="max-h-60 rounded-xl border border-border" />
            <button
              type="button"
              onClick={() => setImagen(null)}
              className="absolute top-2 right-2 rounded-full bg-black/70 p-1 text-white"
              aria-label="Quitar imagen"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        {conFlyer && <ElegirServidorFlyer yo={yo} valor={promocionar} onCambiar={setPromocionar} />}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={async (e) => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (!archivo) return
              setSubiendo(true)
              try {
                const subido = await subirArchivo(archivo)
                if (subido.tipo !== 'imagen') throw new Error('Elegí una imagen.')
                setImagen(subido.url)
              } catch (err) {
                toast.error(mensajeDeError(err))
              } finally {
                setSubiendo(false)
              }
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground"
          >
            <ImagePlus className={cn('size-4', subiendo && 'animate-pulse')} aria-hidden />
            {subiendo ? 'Subiendo…' : 'Imagen'}
          </button>
          {!servidorId && (
            <button
              type="button"
              onClick={() => {
                setConFlyer((v) => !v)
                setPromocionar(null)
              }}
              aria-pressed={conFlyer}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-elevated',
                conFlyer ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Megaphone className="size-4" aria-hidden />
              Promocionar servidor
            </button>
          )}
          <span className="flex-1" />
          <Boton type="submit" cargando={publicando} disabled={!texto.trim() && !imagen && !promocionar} className="h-9">
            Publicar
          </Boton>
        </div>
      </div>
    </form>
  )
}

function Comentarios({ publicacion, miId, onCantidad }: { publicacion: Publicacion; miId: number; onCantidad: (n: number) => void }) {
  const toast = useToast()
  const { data, mutate } = useSWR(['comentarios', publicacion.id], () => getComentarios(publicacion.id))
  const [texto, setTexto] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    try {
      const c = await comentar(publicacion.id, texto.trim())
      setTexto('')
      const nuevos = [...(data ?? []), c]
      mutate(nuevos, { revalidate: false })
      onCantidad(nuevos.length)
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  async function borrar(id: number) {
    try {
      await borrarComentario(id)
      const nuevos = (data ?? []).filter((c) => c.id !== id)
      mutate(nuevos, { revalidate: false })
      onCantidad(nuevos.length)
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {data?.map((c) => (
        <div key={c.id} className="group flex gap-2">
          <Avatar nombre={c.autor.username} url={c.autor.avatar_url} tamanio="sm" />
          <div className="min-w-0 flex-1 rounded-xl bg-elevated/70 px-3 py-1.5">
            <p className="text-xs">
              <span className="font-semibold">{c.autor.username}</span>{' '}
              <span className="text-muted-foreground">{horaMensaje(c.fecha)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{c.contenido}</p>
          </div>
          {(c.autor.id === miId || publicacion.autor.id === miId) && (
            <button
              type="button"
              onClick={() => borrar(c.id)}
              className="self-center rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive"
              aria-label="Borrar comentario"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      <form onSubmit={enviar} className="flex gap-2">
        <input
          aria-label="Escribí un comentario"
          value={texto}
          maxLength={500}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí un comentario…"
          className="h-9 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          aria-label="Comentar"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}

function TarjetaPublicacion({
  p,
  miId,
  puedeBorrar,
  onCambio,
  onBorrada,
  onVerPerfil,
}: {
  p: Publicacion
  miId: number
  puedeBorrar: boolean
  onCambio: (p: Publicacion) => void
  onBorrada: (id: number) => void
  onVerPerfil?: (id: number) => void
}) {
  const toast = useToast()
  const [verComentarios, setVerComentarios] = useState(false)

  async function like() {
    // Se muestra el cambio al instante y después se confirma con la API.
    onCambio({ ...p, me_gusta: !p.me_gusta, likes: p.likes + (p.me_gusta ? -1 : 1) })
    try {
      onCambio(await alternarMeGusta(p.id))
    } catch (err) {
      onCambio(p)
      toast.error(mensajeDeError(err))
    }
  }

  async function borrar() {
    try {
      await borrarPublicacion(p.id)
      onBorrada(p.id)
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => onVerPerfil?.(p.autor.id)} disabled={!onVerPerfil} aria-label={`Ver perfil de ${p.autor.username}`}>
          <Avatar nombre={p.autor.username} url={p.autor.avatar_url} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.autor.username}</p>
          <p className="text-xs text-muted-foreground">{horaMensaje(p.fecha)}</p>
        </div>
        {(puedeBorrar || p.autor.id === miId) && (
          <button
            type="button"
            onClick={borrar}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Borrar publicación"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>
      {p.contenido && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          <TextoConLinks texto={p.contenido} />
        </p>
      )}
      {p.flyer && <TarjetaFlyer flyer={p.flyer} />}
      {p.imagen_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlArchivo(p.imagen_url)} alt="" loading="lazy" className="max-h-[28rem] w-full rounded-xl border border-border object-contain bg-background" />
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={like}
          aria-pressed={p.me_gusta}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-elevated',
            p.me_gusta ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          <Heart className={cn('size-4', p.me_gusta && 'fill-current')} aria-hidden />
          {p.likes}
          <span className="sr-only">me gusta</span>
        </button>
        <button
          type="button"
          onClick={() => setVerComentarios((v) => !v)}
          aria-expanded={verComentarios}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground"
        >
          <MessageCircle className="size-4" aria-hidden />
          {p.comentarios}
          <span className="sr-only">comentarios</span>
        </button>
      </div>
      {verComentarios && (
        <Comentarios publicacion={p} miId={miId} onCantidad={(n) => onCambio({ ...p, comentarios: n })} />
      )}
    </article>
  )
}

/**
 * Lista de publicaciones con "cargar más". Se usa en el feed, en el perfil y
 * en los servidores (cambia la función `cargar`).
 */
export function PublicacionesLista({
  clave,
  cargar,
  yo,
  servidorId,
  permitirPublicar = true,
  puedeModerar = false,
  vacio = 'Todavía no hay publicaciones.',
  onVerPerfil,
}: {
  clave: string
  cargar: (antesDe?: number) => Promise<Publicacion[]>
  yo: Usuario
  servidorId?: number
  permitirPublicar?: boolean
  puedeModerar?: boolean
  vacio?: string
  onVerPerfil?: (id: number) => void
}) {
  const { data, size, setSize, mutate, isLoading } = useSWRInfinite(
    (indice, anterior: Publicacion[] | null) => {
      if (anterior && anterior.length < POR_PAGINA) return null
      return [clave, indice === 0 ? undefined : anterior?.at(-1)?.id]
    },
    ([, antesDe]) => cargar(antesDe as number | undefined),
    { refreshInterval: 30000 },
  )
  const publicaciones = data?.flat() ?? []
  const hayMas = (data?.at(-1)?.length ?? 0) >= POR_PAGINA

  function reemplazar(p: Publicacion) {
    mutate((paginas) => paginas?.map((pag) => pag.map((x) => (x.id === p.id ? p : x))), { revalidate: false })
  }

  return (
    <div className="flex flex-col gap-4">
      {permitirPublicar && (
        <NuevaPublicacion
          yo={yo}
          servidorId={servidorId}
          onCreada={(p) => mutate((paginas) => [[p, ...(paginas?.[0] ?? [])], ...(paginas?.slice(1) ?? [])], { revalidate: false })}
        />
      )}
      {isLoading && publicaciones.length === 0 ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" aria-hidden />
      ) : publicaciones.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{vacio}</p>
      ) : (
        publicaciones.map((p) => (
          <TarjetaPublicacion
            key={p.id}
            p={p}
            miId={yo.id}
            puedeBorrar={puedeModerar}
            onCambio={reemplazar}
            onBorrada={(id) => mutate((paginas) => paginas?.map((pag) => pag.filter((x) => x.id !== id)), { revalidate: false })}
            onVerPerfil={onVerPerfil}
          />
        ))
      )}
      {hayMas && (
        <Boton variante="secundario" onClick={() => setSize(size + 1)} className="self-center">
          Ver más
        </Boton>
      )}
    </div>
  )
}
