'use client'

/**
 * Paneles laterales del chat de un servidor: mensajes fijados, búsqueda
 * y sección de multimedia.
 */

import { useState } from 'react'
import useSWR from 'swr'
import { FileText, Play, Search, X } from 'lucide-react'
import {
  buscarMensajes,
  getFijados,
  getMultimedia,
  urlArchivo,
  type Canal,
  type Mensaje,
  type TipoMultimedia,
} from '@/lib/api'
import { horaMensaje } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { AdjuntoView } from './adjunto-view'
import { nombreVisible } from './message-item'
import { extraerLinks, TextoConLinks } from './texto-enriquecido'
import { Avatar, Input } from './ui'

export function PanelLateral({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string
  onCerrar: () => void
  children: React.ReactNode
}) {
  return (
    <aside aria-label={titulo} className="flex h-full w-80 max-w-[90vw] flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
          aria-label={`Cerrar ${titulo.toLowerCase()}`}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">{children}</div>
    </aside>
  )
}

/** Tarjeta compacta de un mensaje (para fijados y resultados de búsqueda). */
function TarjetaMensaje({ m, canal, onIr }: { m: Mensaje; canal?: string; onIr?: () => void }) {
  return (
    <button
      type="button"
      onClick={onIr}
      disabled={!onIr}
      className="flex w-full flex-col gap-1.5 rounded-xl border border-border bg-background/60 p-3 text-left transition-colors hover:border-primary/40 disabled:hover:border-border"
    >
      <span className="flex items-center gap-2">
        <Avatar nombre={m.autor_username} url={m.autor_avatar_url} tamanio="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{nombreVisible(m)}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{horaMensaje(m.fecha)}</span>
      </span>
      {canal && <span className="text-[11px] text-muted-foreground">en {canal}</span>}
      {m.contenido && (
        <span className="line-clamp-4 whitespace-pre-wrap break-words text-sm text-foreground/90">
          {m.encuesta ? `📊 ${m.contenido}` : m.contenido}
        </span>
      )}
      {m.adjunto && !m.contenido && (
        <span className="text-xs text-muted-foreground">📎 {m.adjunto.nombre ?? m.adjunto.tipo}</span>
      )}
    </button>
  )
}

export function FijadosPanel({ canal, onCerrar }: { canal: Canal; onCerrar: () => void }) {
  const { data, isLoading } = useSWR(['fijados', canal.id], () => getFijados(canal.id), { refreshInterval: 10000 })
  return (
    <PanelLateral titulo={`Fijados en ${canal.nombre}`} onCerrar={onCerrar}>
      {isLoading && !data ? (
        <p className="p-2 text-sm text-muted-foreground">Cargando…</p>
      ) : data && data.length > 0 ? (
        data.map((m) => <TarjetaMensaje key={m.id} m={m} />)
      ) : (
        <p className="p-2 text-sm text-muted-foreground">
          Todavía no hay mensajes fijados. Los moderadores pueden fijar un mensaje pasando el mouse sobre él.
        </p>
      )}
    </PanelLateral>
  )
}

export function BusquedaPanel({
  servidorId,
  canales,
  onIrACanal,
  onCerrar,
}: {
  servidorId: number
  canales: Canal[]
  onIrACanal: (canalId: number) => void
  onCerrar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [consulta, setConsulta] = useState('')
  const [canalId, setCanalId] = useState<number | undefined>()
  const { data, error, isLoading } = useSWR(
    consulta.length >= 2 ? ['buscar', servidorId, consulta, canalId] : null,
    () => buscarMensajes(servidorId, consulta, canalId),
    { onError: () => {} },
  )
  const nombreCanal = (id: number) => canales.find((c) => c.id === id)?.nombre

  return (
    <PanelLateral titulo="Buscar mensajes" onCerrar={onCerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setConsulta(texto.trim())
        }}
        className="flex flex-col gap-2"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            aria-label="Texto a buscar"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar… (Enter)"
            className="h-10 pl-9"
          />
        </div>
        <select
          aria-label="Canal"
          value={canalId ?? ''}
          onChange={(e) => setCanalId(e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">En todos los canales</option>
          {canales
            .filter((c) => c.tipo === 'texto')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
      </form>

      {consulta.length > 0 && consulta.length < 2 && (
        <p className="p-2 text-sm text-muted-foreground">Escribí al menos 2 caracteres.</p>
      )}
      {error && <p className="p-2 text-sm text-destructive">No pudimos buscar. Probá de nuevo.</p>}
      {isLoading && <p className="p-2 text-sm text-muted-foreground">Buscando…</p>}
      {data && (
        <>
          <p className="px-1 text-xs text-muted-foreground">
            {data.length === 0 ? 'No encontramos nada.' : `${data.length}${data.length === 25 ? '+' : ''} resultados`}
          </p>
          {data.map((m) => (
            <TarjetaMensaje key={m.id} m={m} canal={nombreCanal(m.canal_id)} onIr={() => onIrACanal(m.canal_id)} />
          ))}
        </>
      )}
    </PanelLateral>
  )
}

const PESTANIAS: { valor: TipoMultimedia; etiqueta: string }[] = [
  { valor: 'imagen', etiqueta: 'Fotos' },
  { valor: 'video', etiqueta: 'Videos' },
  { valor: 'audio', etiqueta: 'Audios' },
  { valor: 'link', etiqueta: 'Links' },
  { valor: 'archivo', etiqueta: 'Archivos' },
]

export function MultimediaPanel({ servidorId, onCerrar }: { servidorId: number; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<TipoMultimedia>('imagen')
  const { data, isLoading } = useSWR(['multimedia', servidorId, tipo], () => getMultimedia(servidorId, tipo))

  return (
    <PanelLateral titulo="Multimedia del servidor" onCerrar={onCerrar}>
      <div role="tablist" className="flex flex-wrap gap-1">
        {PESTANIAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            role="tab"
            aria-selected={tipo === p.valor}
            onClick={() => setTipo(p.valor)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              tipo === p.valor ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <p className="p-2 text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.length === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">Todavía no se compartió nada de este tipo.</p>
      ) : tipo === 'imagen' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {data.map(
            (m) =>
              m.adjunto && (
                <a
                  key={m.id}
                  href={urlArchivo(m.adjunto.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`De ${nombreVisible(m)} · ${horaMensaje(m.fecha)}`}
                  className="block aspect-square overflow-hidden rounded-lg border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlArchivo(m.adjunto.url)} alt="" loading="lazy" className="size-full object-cover transition-transform hover:scale-105" />
                </a>
              ),
          )}
        </div>
      ) : tipo === 'video' ? (
        // Videos: el video mismo en chiquito; al tocarlo se abre grande.
        <div className="grid grid-cols-2 gap-1.5">
          {data.map(
            (m) =>
              m.adjunto && (
                <a
                  key={m.id}
                  href={urlArchivo(m.adjunto.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`De ${nombreVisible(m)} · ${horaMensaje(m.fecha)}`}
                  className="group relative block aspect-video overflow-hidden rounded-lg border border-border bg-black"
                >
                  <video
                    src={`${urlArchivo(m.adjunto.url)}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute inset-0 m-auto flex size-9 items-center justify-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110">
                    <Play className="size-4 fill-white" aria-hidden />
                  </span>
                </a>
              ),
          )}
        </div>
      ) : tipo === 'link' ? (
        <ul className="flex flex-col gap-2">
          {data.flatMap((m) =>
            extraerLinks(m.contenido).map((url) => (
              <li key={`${m.id}-${url}`} className="rounded-lg border border-border bg-background/60 p-2.5 text-sm">
                <TextoConLinks texto={url} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {nombreVisible(m)} · {horaMensaje(m.fecha)}
                </p>
              </li>
            )),
          )}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map(
            (m) =>
              m.adjunto && (
                <li key={m.id} className="rounded-lg border border-border bg-background/60 p-2.5">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {tipo === 'archivo' && <FileText className="size-3" aria-hidden />}
                    {nombreVisible(m)} · {horaMensaje(m.fecha)}
                  </p>
                  <AdjuntoView adjunto={m.adjunto} />
                </li>
              ),
          )}
        </ul>
      )}
    </PanelLateral>
  )
}
