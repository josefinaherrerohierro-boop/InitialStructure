'use client'

import { useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { enviarMensaje, mensajeDeError, type Mensaje } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useToast } from './toast-provider'

const MAX = 2000

export function Composer({
  canalId,
  canalNombre,
  onEnviado,
}: {
  canalId: number
  canalNombre: string
  onEnviado: (m: Mensaje) => void
}) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()

  async function enviar() {
    const contenido = texto.trim()
    if (!contenido || enviando) return
    setEnviando(true)
    try {
      const m = await enviarMensaje(canalId, contenido)
      setTexto('')
      onEnviado(m)
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setEnviando(false)
      ref.current?.focus()
    }
  }

  const restantes = MAX - texto.length
  const filas = Math.min(8, Math.max(1, texto.split('\n').length))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="px-4 pb-4"
    >
      <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-2 transition-colors focus-within:border-primary/50">
        <label htmlFor="composer" className="sr-only">
          Escribí un mensaje en #{canalNombre}
        </label>
        <textarea
          id="composer"
          ref={ref}
          value={texto}
          maxLength={MAX}
          rows={filas}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              e.preventDefault()
              enviar()
            }
          }}
          placeholder={`Escribí un mensaje en #${canalNombre}…`}
          className="scrollbar-thin max-h-48 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs tabular-nums',
              restantes < 100 ? (restantes <= 0 ? 'text-destructive' : 'text-warning') : 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {texto.length}/{MAX}
          </span>
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Enter para enviar · Shift+Enter para salto de línea</p>
    </form>
  )
}
