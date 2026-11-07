'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Copy, Trash2 } from 'lucide-react'
import { borrarInvitacion, getInvitaciones, mensajeDeError, type Invitacion } from '@/lib/api'
import { horaMensaje, parseFecha, type Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { useToast } from '../toast-provider'
import { Seccion } from './confirmar'

function estado(inv: Invitacion): { texto: string; clase: string } {
  if (parseFecha(inv.fecha_vencimiento).getTime() <= Date.now()) {
    return { texto: 'Vencida', clase: 'bg-destructive/15 text-destructive' }
  }
  if (inv.usos >= inv.usos_maximos) return { texto: 'Agotada', clase: 'bg-warning/15 text-warning' }
  return { texto: 'Activa', clase: 'bg-success/15 text-success' }
}

/** HU5: ver y borrar las invitaciones del servidor. */
export function InvitacionesTab({
  servidorId,
  permisos,
  miId,
}: {
  servidorId: number
  permisos: Permisos
  miId: number
}) {
  const toast = useToast()
  const { data: invitaciones, mutate, isLoading } = useSWR(['invitaciones', servidorId], () =>
    getInvitaciones(servidorId),
  )
  const [copiado, setCopiado] = useState<string | null>(null)

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invitacion/${codigo}`)
      setCopiado(codigo)
      window.setTimeout(() => setCopiado(null), 2000)
    } catch {
      toast.error('No pudimos copiar el link.')
    }
  }

  async function borrar(codigo: string) {
    try {
      await borrarInvitacion(codigo)
      toast.exito('Invitación borrada.')
      mutate()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <Seccion
      titulo="Invitaciones"
      descripcion="Para crear una nueva, usá el botón “Invitar gente” de la barra lateral."
    >
      {isLoading && !invitaciones ? (
        <div className="h-24 animate-pulse rounded-lg bg-elevated/60" aria-hidden />
      ) : invitaciones && invitaciones.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Código</th>
                <th className="pb-2 font-medium">Usos</th>
                <th className="pb-2 font-medium">Vence</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invitaciones.map((inv) => {
                const e = estado(inv)
                const puedeBorrar = inv.creador_id === miId || permisos.esModerador
                return (
                  <tr key={inv.id}>
                    <td className="py-2.5 font-mono font-semibold text-primary">{inv.codigo}</td>
                    <td className="py-2.5 tabular-nums">
                      {inv.usos}/{inv.usos_maximos}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{horaMensaje(inv.fecha_vencimiento)}</td>
                    <td className="py-2.5">
                      <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', e.clase)}>{e.texto}</span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => copiar(inv.codigo)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground"
                          aria-label={`Copiar link de ${inv.codigo}`}
                        >
                          {copiado === inv.codigo ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                        </button>
                        {puedeBorrar && (
                          <button
                            type="button"
                            onClick={() => borrar(inv.codigo)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            aria-label={`Borrar ${inv.codigo}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no hay invitaciones.</p>
      )}
    </Seccion>
  )
}
