'use client'

import { Download, FileText } from 'lucide-react'
import { urlArchivo, type Adjunto } from '@/lib/api'

/** Muestra el archivo adjunto de un mensaje según su tipo. */
export function AdjuntoView({ adjunto }: { adjunto: Adjunto }) {
  const url = urlArchivo(adjunto.url)
  if (!url) return null

  if (adjunto.tipo === 'imagen') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={adjunto.nombre ?? 'Imagen adjunta'}
          loading="lazy"
          className="max-h-80 max-w-[min(24rem,75vw)] rounded-lg border border-border object-contain"
        />
      </a>
    )
  }
  if (adjunto.tipo === 'video') {
    return (
      <video src={url} controls preload="metadata" className="mt-1.5 max-h-80 w-[min(28rem,75vw)] rounded-lg border border-border">
        Tu navegador no puede reproducir este video.
      </video>
    )
  }
  if (adjunto.tipo === 'audio') {
    return (
      <div className="mt-1.5 w-72 max-w-[75vw] rounded-2xl border border-border bg-surface p-2">
        <audio src={url} controls preload="metadata" className="h-9 w-full">
          Tu navegador no puede reproducir este audio.
        </audio>
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={adjunto.nombre ?? undefined}
      className="mt-1.5 flex w-72 max-w-[75vw] items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 hover:bg-elevated"
    >
      <FileText className="size-6 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">{adjunto.nombre ?? 'Archivo'}</span>
      <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  )
}
