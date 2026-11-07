'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { borrarMensaje, editarMensaje, mensajeDeError, type Mensaje } from '@/lib/api'
import { horaMensaje, soloHora } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { useToast } from './toast-provider'
import { Avatar } from './ui'

const MAX = 2000

export function MessageItem({
  mensaje,
  agrupado,
  puedeEditar,
  puedeBorrar,
  onEditado,
  onBorrado,
}: {
  mensaje: Mensaje
  agrupado: boolean
  puedeEditar: boolean
  puedeBorrar: boolean
  onEditado: (m: Mensaje) => void
  onBorrado: (id: number) => void
}) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(mensaje.contenido)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    const contenido = borrador.trim()
    if (!contenido || contenido === mensaje.contenido) {
      setEditando(false)
      return
    }
    setOcupado(true)
    try {
      const m = await editarMensaje(mensaje.id, contenido)
      onEditado(m)
      setEditando(false)
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function borrar() {
    setOcupado(true)
    try {
      await borrarMensaje(mensaje.id)
      onBorrado(mensaje.id)
    } catch (err) {
      toast.error(mensajeDeError(err))
      setOcupado(false)
      setConfirmarBorrado(false)
    }
  }

  return (
    <li
      className={cn(
        'group relative flex gap-3 rounded-lg px-3 transition-colors hover:bg-surface/70',
        agrupado ? 'py-0.5' : 'mt-3 py-1.5',
        (editando || confirmarBorrado) && 'bg-surface/70',
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
          <Avatar nombre={mensaje.autor_username} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!agrupado && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{mensaje.autor_username}</span>
            <time dateTime={mensaje.fecha} className="text-xs text-muted-foreground">
              {horaMensaje(mensaje.fecha)}
            </time>
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
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/95">
            {mensaje.contenido}
            {mensaje.editado && <span className="ml-1.5 text-[11px] text-muted-foreground">(editado)</span>}
          </p>
        )}
      </div>

      {!editando && (puedeEditar || puedeBorrar) && (
        <div
          className={cn(
            'absolute -top-3 right-3 flex items-center gap-0.5 rounded-lg border border-border bg-elevated p-0.5 shadow-md shadow-black/30',
            confirmarBorrado ? 'flex' : 'hidden group-hover:flex group-focus-within:flex',
          )}
        >
          {confirmarBorrado ? (
            <>
              <span className="px-2 text-xs text-muted-foreground">¿Borrar mensaje?</span>
              <button
                type="button"
                onClick={borrar}
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
              {puedeEditar && (
                <button
                  type="button"
                  onClick={() => {
                    setBorrador(mensaje.contenido)
                    setEditando(true)
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-border/60 hover:text-foreground"
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
