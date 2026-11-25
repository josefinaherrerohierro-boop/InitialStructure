'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Crown, GripVertical, Hourglass } from 'lucide-react'
import type { Servidor } from '@/lib/api'
import { parseFecha } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Avatar } from './ui'

/** "Quedan 3 h", "Quedan 2 días"... para los servidores temporales. */
export function tiempoRestante(expira: string): string {
  const ms = parseFecha(expira).getTime() - Date.now()
  if (ms <= 0) return 'Vencido'
  const horas = ms / 3_600_000
  if (horas < 1) return `Quedan ${Math.max(1, Math.round(ms / 60_000))} min`
  if (horas < 48) return `Quedan ${Math.round(horas)} h`
  return `Quedan ${Math.round(horas / 24)} días`
}

/**
 * Lista de mis servidores. Se pueden reordenar arrastrándolos, o con los
 * botones de flecha (que aparecen al pasar el mouse o con el teclado).
 */
export function ServerSelector({
  servidores,
  seleccionadoId,
  miId,
  cargando,
  onSeleccionar,
  onReordenar,
}: {
  servidores: Servidor[] | undefined
  seleccionadoId: number | undefined
  miId: number | undefined
  cargando: boolean
  onSeleccionar: (id: number) => void
  onReordenar?: (ids: number[]) => void
}) {
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)

  function mover(desde: number, hasta: number) {
    if (!servidores || !onReordenar || desde === hasta) return
    const ids = servidores.map((s) => s.id)
    const [movido] = ids.splice(desde, 1)
    ids.splice(hasta, 0, movido)
    onReordenar(ids)
  }

  return (
    <nav aria-label="Tus servidores" className="flex flex-col gap-2">
      <h2 className="px-2 text-xs font-semibold text-muted-foreground">Servidores</h2>
      {cargando && !servidores ? (
        <div className="flex flex-col gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-elevated/60" />
          ))}
        </div>
      ) : servidores && servidores.length > 0 ? (
        <ul className="scrollbar-thin flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
          {servidores.map((s, i) => {
            const activo = s.id === seleccionadoId
            return (
              <li
                key={s.id}
                draggable={!!onReordenar}
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
                className={cn(
                  'group relative rounded-lg',
                  arrastrando === i && 'opacity-40',
                  sobre === i && arrastrando !== i && 'ring-2 ring-primary/50',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSeleccionar(s.id)}
                  aria-current={activo ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                    activo ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
                  )}
                >
                  {onReordenar && (
                    <GripVertical
                      className="-mx-1 size-3.5 shrink-0 cursor-grab opacity-0 group-hover:opacity-50"
                      aria-hidden
                    />
                  )}
                  <Avatar nombre={s.nombre} tamanio="sm" />
                  <span className={cn('flex-1 truncate', activo && 'font-medium')}>{s.nombre}</span>
                  {s.expira_en && (
                    <span title={tiempoRestante(s.expira_en)} className="shrink-0">
                      <Hourglass className="size-3.5 text-primary" aria-label={`Temporal. ${tiempoRestante(s.expira_en)}`} />
                    </span>
                  )}
                  {s.duenio_id === miId && (
                    <Crown className="size-3.5 shrink-0 text-warning" aria-label="Sos el dueño" />
                  )}
                </button>
                {onReordenar && (
                  <span className="absolute top-1/2 right-1 hidden -translate-y-1/2 gap-0.5 rounded-md bg-elevated p-0.5 group-focus-within:flex group-hover:flex">
                    <button
                      type="button"
                      onClick={() => mover(i, i - 1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label={`Subir ${s.nombre}`}
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, i + 1)}
                      disabled={i === servidores.length - 1}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label={`Bajar ${s.nombre}`}
                    >
                      <ArrowDown className="size-3" />
                    </button>
                  </span>
                )}
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
