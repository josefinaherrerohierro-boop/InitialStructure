'use client'

import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { cambiarApodo, mensajeDeError, type Miembro } from '@/lib/api'
import { useToast } from './toast-provider'
import { Avatar } from './ui'

export function MembersPanel({
  miembros,
  cargando,
  miId,
  servidorId,
  puedeModerar = false,
  onCerrar,
  onVerPerfil,
  onCambio,
}: {
  miembros: Miembro[] | undefined
  cargando: boolean
  miId: number | undefined
  servidorId?: number
  puedeModerar?: boolean
  onCerrar: () => void
  onVerPerfil?: (usuarioId: number) => void
  onCambio?: () => void
}) {
  const toast = useToast()
  const [editando, setEditando] = useState<number | null>(null)
  const [apodo, setApodo] = useState('')

  const ordenados = [...(miembros ?? [])].sort((a, b) => {
    if (a.es_duenio !== b.es_duenio) return a.es_duenio ? -1 : 1
    return (a.apodo || a.username).localeCompare(b.apodo || b.username, 'es')
  })

  async function guardarApodo(usuarioId: number) {
    if (!servidorId) return
    try {
      await cambiarApodo(servidorId, usuarioId, apodo.trim() || null)
      setEditando(null)
      onCambio?.()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  // Igual que el backend: el propio apodo siempre; el de otros si sos
  // moderador, salvo el del dueño.
  const puedeEditar = (m: Miembro) => !!servidorId && (m.usuario_id === miId || (puedeModerar && !m.es_duenio))

  return (
    <aside aria-label="Miembros" className="flex h-full w-72 flex-col">
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
                <li key={m.usuario_id} className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-elevated/50">
                  <button
                    type="button"
                    onClick={() => onVerPerfil?.(m.usuario_id)}
                    disabled={!onVerPerfil}
                    aria-label={`Ver perfil de ${m.username}`}
                    className="mt-0.5 rounded-lg"
                  >
                    <Avatar nombre={m.username} url={m.avatar_url} tamanio="sm" />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {editando === m.usuario_id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          guardarApodo(m.usuario_id)
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          autoFocus
                          aria-label="Apodo"
                          value={apodo}
                          maxLength={32}
                          placeholder={m.username}
                          onChange={(e) => setApodo(e.target.value)}
                          onKeyDown={(e) => e.key === 'Escape' && setEditando(null)}
                          className="h-7 min-w-0 flex-1 rounded-md border border-primary/50 bg-background px-2 text-sm outline-none"
                        />
                        <button type="submit" className="rounded-md p-1 text-success hover:bg-elevated" aria-label="Guardar apodo">
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(null)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-elevated"
                          aria-label="Cancelar"
                        >
                          <X className="size-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1">
                        <p className="min-w-0 truncate text-sm font-medium">
                          {m.apodo || m.username}
                          {m.usuario_id === miId && <span className="ml-1 font-normal text-muted-foreground">(vos)</span>}
                        </p>
                        {puedeEditar(m) && (
                          <button
                            type="button"
                            onClick={() => {
                              setApodo(m.apodo ?? '')
                              setEditando(m.usuario_id)
                            }}
                            className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-foreground"
                            aria-label={m.usuario_id === miId ? 'Cambiar mi apodo' : `Cambiar apodo de ${m.username}`}
                            title="Cambiar apodo"
                          >
                            <Pencil className="size-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {m.apodo && editando !== m.usuario_id && (
                      <p className="-mt-1 truncate text-[11px] text-muted-foreground">@{m.username}</p>
                    )}
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
