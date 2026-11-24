'use client'

import { useState } from 'react'
import { Pencil, Pin, PinOff, SmilePlus, Trash2 } from 'lucide-react'
import {
  borrarMensaje,
  editarMensaje,
  fijarMensaje,
  mensajeDeError,
  reaccionar,
  type Mensaje,
} from '@/lib/api'
import { horaMensaje, soloHora } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { AdjuntoView } from './adjunto-view'
import { EMOJIS_RAPIDOS, EmojiPicker } from './emoji-picker'
import { EncuestaView } from './encuesta-view'
import { TextoConLinks, VistaPreviaLinks } from './texto-enriquecido'
import { useToast } from './toast-provider'
import { Avatar } from './ui'

const MAX = 2000

export function nombreVisible(m: Pick<Mensaje, 'autor_apodo' | 'autor_username'>): string {
  return m.autor_apodo || m.autor_username
}

export function MessageItem({
  mensaje,
  agrupado,
  miId,
  puedeEditar,
  puedeBorrar,
  puedeFijar = false,
  puedeReaccionar = true,
  onEditado,
  onBorrado,
  onVerPerfil,
  editar = editarMensaje,
  borrar = borrarMensaje,
}: {
  mensaje: Mensaje
  agrupado: boolean
  miId?: number
  puedeEditar: boolean
  puedeBorrar: boolean
  puedeFijar?: boolean
  puedeReaccionar?: boolean
  /** Se llama cada vez que el mensaje cambia (edición, reacción, fijado o voto). */
  onEditado: (m: Mensaje) => void
  onBorrado: (id: number) => void
  onVerPerfil?: (usuarioId: number) => void
  editar?: (id: number, contenido: string) => Promise<Mensaje>
  borrar?: (id: number) => Promise<void>
}) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(mensaje.contenido)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const esEncuesta = !!mensaje.encuesta
  const nombre = nombreVisible(mensaje)

  async function guardar() {
    const contenido = borrador.trim()
    if (!contenido || contenido === mensaje.contenido) {
      setEditando(false)
      return
    }
    setOcupado(true)
    try {
      onEditado(await editar(mensaje.id, contenido))
      setEditando(false)
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function alBorrar() {
    setOcupado(true)
    try {
      await borrar(mensaje.id)
      onBorrado(mensaje.id)
    } catch (err) {
      toast.error(mensajeDeError(err))
      setOcupado(false)
      setConfirmarBorrado(false)
    }
  }

  async function alReaccionar(emoji: string) {
    try {
      onEditado(await reaccionar(mensaje.id, emoji))
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  async function alFijar() {
    try {
      const m = await fijarMensaje(mensaje.id, !mensaje.fijado)
      onEditado(m)
      toast.exito(m.fijado ? 'Mensaje fijado.' : 'Mensaje desfijado.')
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  const botonAccion =
    'flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-border/60 hover:text-foreground'
  const hayAcciones = puedeReaccionar || puedeFijar || (puedeEditar && !esEncuesta) || puedeBorrar
  const reacciones = mensaje.reacciones ?? []

  return (
    <li
      className={cn(
        'group relative flex gap-3 rounded-lg px-3 transition-colors hover:bg-surface/70',
        agrupado ? 'py-0.5' : 'mt-3 py-1.5',
        (editando || confirmarBorrado) && 'bg-surface/70',
        mensaje.fijado && 'border-l-2 border-warning/60',
      )}
    >
      <div className="w-9 shrink-0">
        {agrupado ? (
          <time
            dateTime={mensaje.fecha}
            className="block pt-1 text-right text-[10px] leading-5 text-muted-foreground opacity-0 group-hover:opacity-100"
          >
            {soloHora(mensaje.fecha)}
          </time>
        ) : (
          <button
            type="button"
            onClick={() => onVerPerfil?.(mensaje.autor_id)}
            disabled={!onVerPerfil}
            aria-label={`Ver perfil de ${nombre}`}
            className="rounded-lg"
          >
            <Avatar nombre={mensaje.autor_username} url={mensaje.autor_avatar_url} />
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!agrupado && (
          <div className="flex items-baseline gap-2">
            <button
              type="button"
              onClick={() => onVerPerfil?.(mensaje.autor_id)}
              disabled={!onVerPerfil}
              className="text-sm font-semibold hover:underline disabled:no-underline"
            >
              {nombre}
            </button>
            {mensaje.autor_apodo && (
              <span className="text-xs text-muted-foreground">@{mensaje.autor_username}</span>
            )}
            <time dateTime={mensaje.fecha} className="text-xs text-muted-foreground">
              {horaMensaje(mensaje.fecha)}
            </time>
            {mensaje.fijado && <Pin className="size-3 self-center text-warning" aria-label="Fijado" />}
          </div>
        )}

        {editando ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <label htmlFor={`editar-${mensaje.id}`} className="sr-only">
              Editar mensaje
            </label>
            <textarea
              id={`editar-${mensaje.id}`}
              autoFocus
              value={borrador}
              maxLength={MAX}
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditando(false)
                  setBorrador(mensaje.contenido)
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  guardar()
                }
              }}
              rows={Math.min(6, borrador.split('\n').length)}
              disabled={ocupado}
              className="w-full resize-none rounded-lg border border-primary/50 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground">
              Enter para{' '}
              <button type="button" onClick={guardar} className="text-primary hover:underline">
                guardar
              </button>{' '}
              · Esc para{' '}
              <button
                type="button"
                onClick={() => {
                  setEditando(false)
                  setBorrador(mensaje.contenido)
                }}
                className="text-primary hover:underline"
              >
                cancelar
              </button>
              <span className="float-right tabular-nums">
                {borrador.length}/{MAX}
              </span>
            </p>
          </div>
        ) : esEncuesta && mensaje.encuesta ? (
          <EncuestaView encuesta={mensaje.encuesta} pregunta={mensaje.contenido} onActualizado={onEditado} />
        ) : (
          <>
            {mensaje.contenido && (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/95">
                <TextoConLinks texto={mensaje.contenido} />
                {mensaje.editado && <span className="ml-1.5 text-[11px] text-muted-foreground">(editado)</span>}
              </p>
            )}
            {mensaje.adjunto && <AdjuntoView adjunto={mensaje.adjunto} />}
            {mensaje.contenido && <VistaPreviaLinks texto={mensaje.contenido} />}
          </>
        )}

        {reacciones.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Reacciones">
            {reacciones.map((r) => {
              const mia = miId !== undefined && r.usuarios.includes(miId)
              return (
                <li key={r.emoji}>
                  <button
                    type="button"
                    onClick={() => puedeReaccionar && alReaccionar(r.emoji)}
                    disabled={!puedeReaccionar}
                    aria-pressed={mia}
                    aria-label={`${r.emoji}: ${r.cantidad}`}
                    className={cn(
                      'flex h-7 items-center gap-1 rounded-lg border px-2 text-sm transition-colors',
                      mia ? 'border-primary/60 bg-primary/15' : 'border-border bg-surface hover:border-primary/40',
                    )}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{r.cantidad}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!editando && hayAcciones && (
        <div
          className={cn(
            'absolute -top-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-elevated p-0.5 shadow-md shadow-black/30',
            confirmarBorrado ? 'flex' : 'hidden group-hover:flex group-focus-within:flex',
          )}
        >
          {confirmarBorrado ? (
            <>
              <span className="px-2 text-xs text-muted-foreground">¿Borrar mensaje?</span>
              <button
                type="button"
                onClick={alBorrar}
                disabled={ocupado}
                className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/25"
              >
                Sí, borrar
              </button>
              <button
                type="button"
                onClick={() => setConfirmarBorrado(false)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                No
              </button>
            </>
          ) : (
            <>
              {puedeReaccionar && (
                <>
                  {EMOJIS_RAPIDOS.slice(0, 4).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => alReaccionar(e)}
                      className="hidden size-7 items-center justify-center rounded-md text-base hover:bg-border/60 sm:flex"
                      aria-label={`Reaccionar con ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                  <EmojiPicker onElegir={alReaccionar} className={botonAccion} etiqueta="Agregar reacción">
                    <SmilePlus className="size-3.5" aria-hidden />
                  </EmojiPicker>
                </>
              )}
              {puedeFijar && (
                <button type="button" onClick={alFijar} className={botonAccion} title={mensaje.fijado ? 'Desfijar' : 'Fijar'}>
                  {mensaje.fijado ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
                  <span className="sr-only">{mensaje.fijado ? 'Desfijar' : 'Fijar'}</span>
                </button>
              )}
              {puedeEditar && !esEncuesta && (
                <button
                  type="button"
                  onClick={() => {
                    setBorrador(mensaje.contenido)
                    setEditando(true)
                  }}
                  className={botonAccion}
                >
                  <Pencil className="size-3" aria-hidden />
                  Editar
                </button>
              )}
              {puedeBorrar && (
                <button
                  type="button"
                  onClick={() => setConfirmarBorrado(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="size-3" aria-hidden />
                  Borrar
                </button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}
