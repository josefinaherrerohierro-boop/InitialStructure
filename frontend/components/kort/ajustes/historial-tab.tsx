'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, Crown, Shield, Tag } from 'lucide-react'
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

/** Ícono y color de cada rol: dueño y moderador se destacan; el resto, neutro. */
function estiloRol(rol: string) {
  if (rol === 'Dueño') return { Icono: Crown, clase: 'bg-warning/15 text-warning' }
  if (rol.toLowerCase().startsWith('moderador')) return { Icono: Shield, clase: 'bg-primary/12 text-primary' }
  return { Icono: Tag, clase: 'bg-elevated text-muted-foreground' }
}

/**
 * Los roles que tenía (o tiene) en el servidor, de a dos por renglón.
 * Si ocupan más de un renglón, se muestra solo el primero y se puede desplegar.
 */
function RolesHistorial({ roles }: { roles: string[] }) {
  const [abierto, setAbierto] = useState(false)
  const lista = roles.length ? roles : ['Miembro']
  const visibles = abierto ? lista : lista.slice(0, 2)
  const ocultos = lista.length - 2

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="grid w-fit grid-cols-2 gap-1">
        {visibles.map((rol, i) => {
          const { Icono, clase } = estiloRol(rol)
          return (
            <span
              key={`${rol}-${i}`}
              className={cn('flex max-w-40 items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium', clase)}
              title={rol}
            >
              <Icono className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{rol}</span>
            </span>
          )
        })}
      </div>
      {ocultos > 0 && (
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className="flex w-fit items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn('size-3 transition-transform', abierto && 'rotate-180')} aria-hidden />
          {abierto ? 'Ver menos' : `Ver ${ocultos} ${ocultos === 1 ? 'rol más' : 'roles más'}`}
        </button>
      )}
    </div>
  )
}

/** Todos los servidores en los que estuviste, con fechas de entrada y salida y tus roles. */
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
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-success" aria-hidden /> Seguís en el servidor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive" aria-hidden /> Ya no estás
        </span>
      </p>
      <ol className="relative flex flex-col gap-2 border-l border-border pl-5">
        {data.map((h) => {
          const motivo = h.motivo_salida ? MOTIVOS[h.motivo_salida] : null
          const sigue = h.sigue_siendo_miembro ?? h.fecha_salida === null
          return (
            <li key={h.id} className="relative flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
              <span
                className={cn(
                  'absolute top-6 -left-[26px] size-2.5 rounded-full ring-4 ring-background',
                  sigue ? 'bg-success' : 'bg-destructive',
                )}
                aria-label={sigue ? 'Seguís en este servidor' : 'Ya no estás en este servidor'}
                role="img"
              />
              <Avatar nombre={h.servidor_nombre} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.servidor_nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {formato.format(parseFecha(h.fecha_union))} →{' '}
                  {h.fecha_salida ? formato.format(parseFecha(h.fecha_salida)) : 'hoy'}
                </p>
                <RolesHistorial roles={h.roles ?? []} />
              </div>
              {motivo && (
                <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium', motivo.clase)}>{motivo.texto}</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
