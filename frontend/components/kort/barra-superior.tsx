'use client'

import { useEffect, useRef, useState } from 'react'
import { Crown, Hourglass, LogOut, Plus, Settings, Ticket } from 'lucide-react'
import type { Servidor, Usuario } from '@/lib/api'
import { cn } from '@/lib/utils'
import { tiempoRestante } from './server-selector'
import { Avatar } from './ui'

/**
 * Pestañas de servidores (arriba, como las pestañas de un navegador).
 * Se reordenan arrastrándolas, o con Alt + flechas sobre una pestaña.
 */
export function PestaniasServidores({
  servidores,
  seleccionadoId,
  miId,
  onSeleccionar,
  onReordenar,
}: {
  servidores: Servidor[] | undefined
  seleccionadoId: number | undefined
  miId: number | undefined
  onSeleccionar: (id: number) => void
  onReordenar: (ids: number[]) => void
}) {
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)

  function mover(desde: number, hasta: number) {
    if (!servidores || hasta < 0 || hasta >= servidores.length || desde === hasta) return
    const ids = servidores.map((s) => s.id)
    const [movido] = ids.splice(desde, 1)
    ids.splice(hasta, 0, movido)
    onReordenar(ids)
  }

  if (!servidores) {
    return (
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-9 w-32 animate-pulse rounded-full bg-surface/70" />
        ))}
      </div>
    )
  }

  return (
    <nav aria-label="Tus servidores" className="scrollbar-thin flex min-w-0 items-center gap-1.5 overflow-x-auto py-1">
      {servidores.map((s, i) => {
        const activo = s.id === seleccionadoId
        return (
          <button
            key={s.id}
            type="button"
            draggable
            onClick={() => onSeleccionar(s.id)}
            onKeyDown={(e) => {
              if (!e.altKey) return
              if (e.key === 'ArrowLeft') mover(i, i - 1)
              if (e.key === 'ArrowRight') mover(i, i + 1)
            }}
            onDragStart={(e) => {
              setArrastrando(i)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              if (arrastrando === null) return
              e.preventDefault()
              setSobre(i)
            }}
            onDragLeave={() => setSobre((v) => (v === i ? null : v))}
            onDrop={(e) => {
              e.preventDefault()
              if (arrastrando !== null) mover(arrastrando, i)
              setArrastrando(null)
              setSobre(null)
            }}
            onDragEnd={() => {
              setArrastrando(null)
              setSobre(null)
            }}
            aria-current={activo ? 'page' : undefined}
            title={`${s.nombre}${s.expira_en ? ` · ${tiempoRestante(s.expira_en)}` : ''} (arrastrá o usá Alt + flechas para reordenar)`}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-all',
              activo
                ? 'border-border bg-surface font-semibold text-foreground shadow-[var(--sombra)]'
                : 'border-transparent text-muted-foreground hover:bg-surface/60 hover:text-foreground',
              arrastrando === i && 'opacity-40',
              sobre === i && arrastrando !== i && 'ring-2 ring-primary/50',
            )}
          >
            <Avatar nombre={s.nombre} tamanio="sm" className="rounded-full" />
            <span className="max-w-40 truncate">{s.nombre}</span>
            {s.expira_en && <Hourglass className="size-3.5 text-primary" aria-label="Temporal" />}
            {s.duenio_id === miId && <Crown className="size-3.5 text-warning" aria-label="Sos el dueño" />}
          </button>
        )
      })}
    </nav>
  )
}

/** Botones para crear un servidor o unirse con un código. */
export function AccionesServidor({ onCrear, onUnirme }: { onCrear: () => void; onUnirme: () => void }) {
  const clase =
    'flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary'
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={onCrear} className={clase} aria-label="Crear servidor" title="Crear servidor">
        <Plus className="size-4" />
      </button>
      <button type="button" onClick={onUnirme} className={clase} aria-label="Unirme con código" title="Unirme con código">
        <Ticket className="size-4" />
      </button>
    </div>
  )
}

/** Avatar arriba a la derecha con el menú de la cuenta. */
export function MenuUsuario({
  usuario,
  onAjustes,
  onSalir,
}: {
  usuario: Usuario | undefined
  onAjustes: () => void
  onSalir: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false)
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Mi cuenta"
        className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-3 pl-1 shadow-[var(--sombra)] transition-colors hover:border-primary/40"
      >
        {usuario ? (
          <Avatar nombre={usuario.username} url={usuario.avatar_url} tamanio="sm" className="rounded-full" />
        ) : (
          <span className="size-7 animate-pulse rounded-full bg-elevated" />
        )}
        <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{usuario?.username}</span>
      </button>
      {abierto && usuario && (
        <div role="menu" className="panel absolute top-full right-0 z-50 mt-2 w-64 p-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar nombre={usuario.username} url={usuario.avatar_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{usuario.username}</p>
              <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAbierto(false)
              onAjustes()
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-elevated"
          >
            <Settings className="size-4 text-muted-foreground" aria-hidden />
            Configuración de usuario
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onSalir}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-4" aria-hidden />
            Salir de la cuenta
          </button>
        </div>
      )}
    </div>
  )
}
