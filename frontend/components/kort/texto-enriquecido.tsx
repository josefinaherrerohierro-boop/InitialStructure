'use client'

import { ExternalLink, Link2 } from 'lucide-react'

const PATRON_LINK = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g

/** Devuelve los links que aparecen en un texto. */
export function extraerLinks(texto: string): string[] {
  return Array.from(new Set(texto.match(PATRON_LINK) ?? []))
}

function idDeYoutube(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v')
  } catch {
    // no es una URL válida
  }
  return null
}

function esImagen(url: string): boolean {
  try {
    return /\.(png|jpe?g|gif|webp)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Texto del mensaje con los links clickeables. */
export function TextoConLinks({ texto }: { texto: string }) {
  const partes = texto.split(PATRON_LINK)
  return (
    <>
      {partes.map((parte, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={parte}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all text-primary underline-offset-2 hover:underline"
          >
            {parte}
          </a>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  )
}

/** Vista previa de los links de un mensaje: videos de YouTube, imágenes o una tarjeta con el sitio. */
export function VistaPreviaLinks({ texto }: { texto: string }) {
  const links = extraerLinks(texto).slice(0, 3)
  if (links.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {links.map((url) => {
        const yt = idDeYoutube(url)
        if (yt) {
          return (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="group/yt block w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.youtube.com/vi/${encodeURIComponent(yt)}/hqdefault.jpg`}
                alt="Miniatura del video de YouTube"
                className="aspect-video w-full object-cover transition-opacity group-hover/yt:opacity-90"
                loading="lazy"
              />
              <span className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-destructive" aria-hidden />
                YouTube
              </span>
            </a>
          )
        }
        if (esImagen(url)) {
          return (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Imagen del link" loading="lazy" className="max-h-72 max-w-sm rounded-lg border border-border" />
            </a>
          )
        }
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex w-full max-w-sm items-center gap-2.5 rounded-lg border border-border border-l-primary border-l-4 bg-surface px-3 py-2 hover:bg-elevated"
          >
            <Link2 className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{dominio(url)}</span>
              <span className="block truncate text-xs text-muted-foreground">{url}</span>
            </span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        )
      })}
    </div>
  )
}
