'use client'

import useSWR from 'swr'
import { getHistorialServidores, type HistorialServidor } from '@/lib/api'
import { parseFecha } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Avatar } from '../ui'

const formato = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

const MOTIVOS: Record<NonNullable<HistorialServidor['motivo_salida']>, { texto: string; clase: string }> = {
  salio: { texto: 'Saliste', clase: 'bg-elevated text-muted-foreground' },
  expulsado: { texto: 'Te expulsaron', clase: 'bg-warning/15 text-warning' },
  baneado: { texto: 'Te banearon', clase: 'bg-destructive/15 text-destructive' },
  servidor_borrado: { texto: 'El servidor se borró', clase: 'bg-elevated text-muted-foreground' },
  servidor_vencido: { texto: 'Servidor temporal vencido', clase: 'bg-elevated text-muted-foreground' },
}

/** Todos los servidores en los que estuviste, con fechas de entrada y salida. */
export function HistorialTab() {
  const { data, isLoading } = useSWR('historial-servidores', getHistorialServidores)

  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-xl bg-surface" aria-hidden />
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Todavía no estuviste en ningún servidor.</p>

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Solo vos podés ver esta lista. Estuviste en {new Set(data.map((h) => h.servidor_id ?? `x${h.id}`)).size}{' '}
        servidores.
      </p>
      <ol className="relative flex flex-col gap-2 border-l border-border pl-5">
        {data.map((h) => {
          const motivo = h.motivo_salida ? MOTIVOS[h.motivo_salida] : null
          return (
            <li key={h.id} className="relative flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <span
                className={cn(
                  'absolute top-1/2 -left-[26px] size-2.5 -translate-y-1/2 rounded-full ring-4 ring-background',
                  h.fecha_salida ? 'bg-border' : 'bg-success',
                )}
                aria-hidden
              />
              <Avatar nombre={h.servidor_nombre} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.servidor_nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {formato.format(parseFecha(h.fecha_union))} →{' '}
                  {h.fecha_salida ? formato.format(parseFecha(h.fecha_salida)) : 'hoy'}
                </p>
              </div>
              {motivo ? (
                <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium', motivo.clase)}>{motivo.texto}</span>
              ) : (
                <span className="shrink-0 rounded-md bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">Miembro</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
