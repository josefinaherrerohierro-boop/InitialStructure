'use client'

import { X } from 'lucide-react'
import type { Miembro } from '@/lib/api'
import { Avatar } from './ui'

export function MembersPanel({
  miembros,
  cargando,
  miId,
  onCerrar,
}: {
  miembros: Miembro[] | undefined
  cargando: boolean
  miId: number | undefined
  onCerrar: () => void
}) {
  const ordenados = [...(miembros ?? [])].sort((a, b) => {
    if (a.es_duenio !== b.es_duenio) return a.es_duenio ? -1 : 1
    return a.username.localeCompare(b.username, 'es')
  })

  return (
    <aside aria-label="Miembros" className="flex h-full w-72 flex-col border-l border-border bg-surface">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">
          Miembros{miembros ? <span className="ml-1.5 text-muted-foreground">{miembros.length}</span> : null}
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
          aria-label="Ocultar miembros"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="scrollbar-thin flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {cargando && !miembros
          ? [0, 1, 2, 3].map((i) => <li key={i} className="h-12 animate-pulse rounded-lg bg-elevated/60" aria-hidden />)
          : ordenados.map((m) => {
              const roles = m.roles.filter((r) => r.nombre !== '@everyone')
              return (
                <li key={m.usuario_id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-elevated/50">
                  <Avatar nombre={m.username} tamanio="sm" className="mt-0.5" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-sm font-medium">
                      {m.username}
                      {m.usuario_id === miId && <span className="ml-1 font-normal text-muted-foreground">(vos)</span>}
                    </p>
                    {(m.es_duenio || roles.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {m.es_duenio && (
                          <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                            Dueño
                          </span>
                        )}
                        {roles.map((r) => (
                          <span
                            key={r.id}
                            className="rounded-md bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {r.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
      </ul>
    </aside>
  )
}
