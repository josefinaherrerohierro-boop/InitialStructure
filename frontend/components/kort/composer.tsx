'use client'

import { useEffect, useRef, useState } from 'react'
import { BarChart3, FileText, Mic, Paperclip, Play, SendHorizontal, Smile, Square, X } from 'lucide-react'
import {
  mensajeDeError,
  subirArchivo,
  TAMANIO_MAXIMO_ARCHIVO,
  urlArchivo,
  type Adjunto,
  type Mensaje,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { EmojiPicker } from './emoji-picker'
import { useToast } from './toast-provider'

const MAX = 2000

function duracion(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

/** Elige el formato de audio que soporte el navegador para grabar. */
function formatoDeAudio(): { mime: string; extension: string } {
  const opciones = [
    { mime: 'audio/webm;codecs=opus', extension: 'webm' },
    { mime: 'audio/webm', extension: 'webm' },
    { mime: 'audio/ogg;codecs=opus', extension: 'ogg' },
    { mime: 'audio/mp4', extension: 'm4a' },
  ]
  return opciones.find((o) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(o.mime)) ?? opciones[1]
}

export function Composer({
  destino,
  onEnviar,
  onEnviado,
  onEncuesta,
}: {
  /** Texto del placeholder, ej: "#general" o "@ana". */
  destino: string
  onEnviar: (contenido: string, adjunto: Adjunto | null) => Promise<Mensaje>
  onEnviado: (m: Mensaje) => void
  /** Si se pasa, aparece el botón para crear una encuesta. */
  onEncuesta?: () => void
}) {
  const [texto, setTexto] = useState('')
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const grabador = useRef<MediaRecorder | null>(null)
  const cancelarGrabacion = useRef(false)
  const toast = useToast()

  // Si se cierra el chat mientras se graba, apagamos el micrófono.
  useEffect(() => {
    return () => {
      cancelarGrabacion.current = true
      grabador.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (!grabando) return
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [grabando])

  async function subir(archivo: Blob, nombre: string) {
    if (archivo.size > TAMANIO_MAXIMO_ARCHIVO) {
      toast.error('El archivo no puede pesar más de 15 MB.')
      return null
    }
    setSubiendo(true)
    try {
      const subido = await subirArchivo(archivo, nombre)
      return { url: subido.url, tipo: subido.tipo, nombre: subido.nombre } satisfies Adjunto
    } catch (err) {
      toast.error(mensajeDeError(err))
      return null
    } finally {
      setSubiendo(false)
    }
  }

  async function enviar(adjuntoForzado?: Adjunto) {
    // Los audios se mandan solos (sin el texto que haya en la caja).
    const contenido = adjuntoForzado ? '' : texto.trim()
    const adj = adjuntoForzado ?? adjunto
    if ((!contenido && !adj) || enviando || subiendo) return
    setEnviando(true)
    try {
      const m = await onEnviar(contenido, adj)
      if (!adjuntoForzado) {
        setTexto('')
        setAdjunto(null)
      }
      onEnviado(m)
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setEnviando(false)
      ref.current?.focus()
    }
  }

  async function empezarGrabacion() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      toast.error('No pudimos usar tu micrófono. Revisá que el navegador tenga permiso.')
      return
    }
    const { mime, extension } = formatoDeAudio()
    const rec = new MediaRecorder(stream, { mimeType: mime })
    const partes: Blob[] = []
    rec.ondataavailable = (e) => e.data.size > 0 && partes.push(e.data)
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      setGrabando(false)
      grabador.current = null
      if (cancelarGrabacion.current || partes.length === 0) return
      const audio = new Blob(partes, { type: mime.split(';')[0] })
      const subido = await subir(audio, `audio.${extension}`)
      // El audio se manda solo, sin esperar a que aprieten "Enviar" (como en WhatsApp).
      if (subido) await enviar(subido)
    }
    cancelarGrabacion.current = false
    grabador.current = rec
    setSegundos(0)
    setGrabando(true)
    rec.start()
  }

  function terminarGrabacion(cancelar: boolean) {
    cancelarGrabacion.current = cancelar
    grabador.current?.stop()
  }

  const restantes = MAX - texto.length
  const filas = Math.min(8, Math.max(1, texto.split('\n').length))
  const botonIcono =
    'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-40'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="px-4 pb-4"
    >
      {adjunto && (
        <div className="mb-2 flex w-fit max-w-full items-center gap-3 rounded-xl border border-border bg-surface p-2 pr-3">
          {adjunto.tipo === 'imagen' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlArchivo(adjunto.url)} alt="" className="size-14 rounded-lg object-cover" />
          ) : adjunto.tipo === 'video' ? (
            // El video mismo, en chiquito (#t=0.1: para que muestre un cuadro y no quede negro).
            <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-black">
              <video src={`${urlArchivo(adjunto.url)}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
              <Play className="absolute inset-0 m-auto size-5 fill-white text-white drop-shadow" aria-hidden />
            </span>
          ) : (
            <span className="flex size-14 items-center justify-center rounded-lg bg-elevated">
              <FileText className="size-6 text-primary" aria-hidden />
            </span>
          )}
          <span className="min-w-0 truncate text-sm">{adjunto.nombre}</span>
          <button
            type="button"
            onClick={() => setAdjunto(null)}
            className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
            aria-label="Quitar adjunto"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1 rounded-3xl border border-border bg-elevated p-1.5 transition-colors focus-within:border-primary/60 focus-within:bg-surface">
        <input
          ref={inputArchivo}
          type="file"
          className="hidden"
          accept="image/*,audio/*,video/*,.pdf,.txt,.zip,.docx,.xlsx,.pptx"
          onChange={async (e) => {
            const archivo = e.target.files?.[0]
            e.target.value = ''
            if (!archivo) return
            const subido = await subir(archivo, archivo.name)
            if (subido) setAdjunto(subido)
          }}
        />

        {grabando ? (
          <div className="flex flex-1 items-center gap-3 px-2 py-1.5" aria-live="polite">
            <span className="size-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
            <span className="text-sm">Grabando audio… {duracion(segundos)}</span>
            <button
              type="button"
              onClick={() => terminarGrabacion(true)}
              className="ml-auto rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => terminarGrabacion(false)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Square className="size-3" aria-hidden />
              Enviar audio
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputArchivo.current?.click()}
              disabled={subiendo || enviando}
              className={botonIcono}
              aria-label="Adjuntar archivo"
              title="Adjuntar imagen, video o archivo"
            >
              <Paperclip className={cn('size-4', subiendo && 'animate-pulse')} />
            </button>
            {onEncuesta && (
              <button type="button" onClick={onEncuesta} className={botonIcono} aria-label="Crear encuesta" title="Crear encuesta">
                <BarChart3 className="size-4" />
              </button>
            )}
            <label htmlFor="composer" className="sr-only">
              Escribí un mensaje en {destino}
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
              onPaste={async (e) => {
                // Pegar una imagen (captura de pantalla) la adjunta.
                const archivo = Array.from(e.clipboardData.files)[0]
                if (!archivo) return
                e.preventDefault()
                const subido = await subir(archivo, archivo.name || 'imagen.png')
                if (subido) setAdjunto(subido)
              }}
              placeholder={`Escribí un mensaje en ${destino}…`}
              className="scrollbar-thin max-h-48 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex items-center gap-1">
              {texto.length > MAX - 200 && (
                <span
                  className={cn('px-1 text-xs tabular-nums', restantes <= 0 ? 'text-destructive' : 'text-warning')}
                  aria-live="polite"
                >
                  {texto.length}/{MAX}
                </span>
              )}
              <EmojiPicker onElegir={(e) => setTexto((t) => t + e)} className={botonIcono} etiqueta="Insertar emoji">
                <Smile className="size-4" />
              </EmojiPicker>
              {!texto.trim() && !adjunto ? (
                <button
                  type="button"
                  onClick={empezarGrabacion}
                  disabled={subiendo || enviando}
                  className={botonIcono}
                  aria-label="Grabar audio"
                  title="Grabar audio"
                >
                  <Mic className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={enviando || subiendo}
                  className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
                  aria-label="Enviar mensaje"
                >
                  <SendHorizontal className="size-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Enter para enviar · Shift+Enter para salto de línea · Podés pegar imágenes
      </p>
    </form>
  )
}
