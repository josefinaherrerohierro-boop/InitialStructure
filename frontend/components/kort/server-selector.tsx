'use client'

import { Crown } from 'lucide-react'
import type { Servidor } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Avatar } from './ui'

export function ServerSelector({
  servidores,
  seleccionadoId,
  miId,
  cargando,
  onSeleccionar,
}: {
  servidores: Servidor[] | undefined
  seleccionadoId: number | undefined
  miId: number | undefined
  cargando: boolean
  onSeleccionar: (id: number) => void
}) {
  return (
    <nav aria-label="Tus servidores" className="flex flex-col gap-2">
      <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Servidores</h2>
      {cargando && !servidores ? (
        <div className="flex flex-col gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-elevated/60" />
          ))}
        </div>
      ) : servidores && servidores.length > 0 ? (
        <ul className="scrollbar-thin flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
          {servidores.map((s) => {
            const activo = s.id === seleccionadoId
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSeleccionar(s.id)}
                  aria-current={activo ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                    activo ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
                  )}
                >
                  <Avatar nombre={s.nombre} tamanio="sm" />
                  <span className={cn('flex-1 truncate', activo && 'font-medium')}>{s.nombre}</span>
                  {s.duenio_id === miId && (
                    <Crown className="size-3.5 shrink-0 text-warning" aria-label="Sos el dueño" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-2 text-sm text-muted-foreground">Todavía no estás en ningún servidor.</p>
      )}
    </nav>
  )
}
