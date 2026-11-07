'use client'

import { Hash, Lock, Plus, Settings, UserPlus, Volume2 } from 'lucide-react'
import type { Canal, Servidor } from '@/lib/api'
import type { Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'

function Grupo({
  titulo,
  canales,
  seleccionadoId,
  onSeleccionar,
}: {
  titulo: string
  canales: Canal[]
  seleccionadoId: number | undefined
  onSeleccionar: (id: number) => void
}) {
  if (canales.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      <ul className="flex flex-col gap-0.5">
        {canales.map((c) => {
          const activo = c.id === seleccionadoId
          const Icono = c.tipo === 'voz' ? Volume2 : Hash
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSeleccionar(c.id)}
                aria-current={activo ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                  activo ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:bg-elevated/60 hover:text-foreground',
                )}
              >
                <Icono className={cn('size-4 shrink-0', activo ? 'text-primary' : 'opacity-70')} aria-hidden />
                <span className="flex-1 truncate">{c.nombre}</span>
                {c.solo_lectura && <Lock className="size-3.5 shrink-0 opacity-70" aria-label="Solo lectura" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ChannelList({
  servidor,
  canales,
  cargando,
  seleccionadoId,
  permisos,
  onSeleccionar,
  onCrearCanal,
  onInvitar,
  onConfigurar,
}: {
  servidor: Servidor
  canales: Canal[] | undefined
  cargando: boolean
  seleccionadoId: number | undefined
  permisos: Permisos
  onSeleccionar: (id: number) => void
  onCrearCanal: () => void
  onInvitar: () => void
  onConfigurar: () => void
}) {
  const texto = canales?.filter((c) => c.tipo === 'texto') ?? []
  const voz = canales?.filter((c) => c.tipo === 'voz') ?? []

  return (
    <section aria-label={`Canales de ${servidor.nombre}`} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-2">
        <h2 className="truncate text-sm font-semibold">{servidor.nombre}</h2>
        <div className="flex shrink-0 items-center">
          {permisos.esModerador && (
            <button
              type="button"
              onClick={onCrearCanal}
              className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
              aria-label="Crear canal"
              title="Crear canal"
            >
              <Plus className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onConfigurar}
            className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
            aria-label="Configuración del servidor"
            title="Configuración del servidor"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      {permisos.puedeInvitar && (
        <button
          type="button"
          onClick={onInvitar}
          className="mx-0.5 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <UserPlus className="size-4" aria-hidden />
          Invitar gente
        </button>
      )}

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {cargando && !canales ? (
          <div className="flex flex-col gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-elevated/60" />
            ))}
          </div>
        ) : (
          <>
            <Grupo titulo="Texto" canales={texto} seleccionadoId={seleccionadoId} onSeleccionar={onSeleccionar} />
            <Grupo titulo="Voz" canales={voz} seleccionadoId={seleccionadoId} onSeleccionar={onSeleccionar} />
            {canales && canales.length === 0 && (
              <p className="px-2 text-sm text-muted-foreground">Este servidor no tiene canales.</p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
