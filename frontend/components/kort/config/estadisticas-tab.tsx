'use client'

import useSWR from 'swr'
import { Hash, Users } from 'lucide-react'
import { getCanalesInactivos, getCrecimiento, getTopUsuarios, type CantidadPorMes } from '@/lib/api'
import { horaMensaje } from '@/lib/kort'
import { Avatar } from '../ui'
import { Seccion } from './confirmar'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-11" → "nov 2026" */
function nombreMes(mes: string): string {
  const [anio, numero] = mes.split('-')
  return `${MESES[Number(numero) - 1] ?? numero} ${anio}`
}

/** Gráfico de barras simple hecho con divs (no necesita librerías). */
function BarrasPorMes({ datos, color }: { datos: CantidadPorMes[]; color: string }) {
  if (datos.length === 0) return <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
  const maximo = Math.max(...datos.map((d) => d.cantidad), 1)
  return (
    <div className="flex h-44 items-end gap-3 overflow-x-auto pt-4">
      {datos.map((d) => (
        <div key={d.mes} className="flex min-w-12 flex-1 flex-col items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums">{d.cantidad}</span>
          <div
            className="w-full max-w-12 rounded-t-md"
            style={{ height: `${Math.max(6, (d.cantidad / maximo) * 110)}px`, backgroundColor: color }}
          />
          <span className="text-[11px] whitespace-nowrap text-muted-foreground">{nombreMes(d.mes)}</span>
        </div>
      ))}
    </div>
  )
}

/** HU11 y HU12: estadísticas del servidor (solo el dueño). */
export function EstadisticasTab({ servidorId }: { servidorId: number }) {
  const { data: top } = useSWR(['top', servidorId], () => getTopUsuarios(servidorId))
  const { data: inactivos } = useSWR(['inactivos', servidorId], () => getCanalesInactivos(servidorId))
  const { data: crecimiento } = useSWR(['crecimiento', servidorId], () => getCrecimiento(servidorId))
  const maxMensajes = Math.max(...(top ?? []).map((t) => t.cantidad_mensajes), 1)

  return (
    <div className="flex flex-col gap-6">
      {/* HU12: total actual de miembros */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Users className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-3xl font-semibold tabular-nums">{crecimiento?.total_miembros_actuales ?? '–'}</p>
          <p className="text-sm text-muted-foreground">miembros actuales (sin contar baneados)</p>
        </div>
      </div>

      {/* HU11: top 10 de los últimos 30 días */}
      <Seccion titulo="Los más activos" descripcion="Los 10 miembros con más mensajes en los últimos 30 días.">
        {top && top.length > 0 ? (
          <ol className="flex flex-col gap-2.5">
            {top.map((t, i) => (
              <li key={t.usuario_id} className="flex items-center gap-3">
                <span className="w-5 text-right text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                <Avatar nombre={t.username} tamanio="sm" />
                <span className="w-28 truncate text-sm">{t.username}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(t.cantidad_mensajes / maxMensajes) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-semibold tabular-nums">{t.cantidad_mensajes}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Nadie escribió en los últimos 30 días.</p>
        )}
      </Seccion>

      {/* HU11: canales de texto sin mensajes en 30 días */}
      <Seccion titulo="Canales sin actividad" descripcion="Canales de texto sin mensajes en los últimos 30 días.">
        {inactivos && inactivos.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border">
            {inactivos.map((c) => (
              <li key={c.canal_id} className="flex items-center gap-2 py-2.5 text-sm">
                <Hash className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1 font-medium">{c.nombre}</span>
                <span className="text-muted-foreground">
                  {c.ultimo_mensaje ? `Último mensaje: ${horaMensaje(c.ultimo_mensaje)}` : 'Nunca tuvo mensajes'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Todos los canales de texto tuvieron actividad. 🎉</p>
        )}
      </Seccion>

      {/* HU12: crecimiento por mes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Nuevos miembros por mes">
          <BarrasPorMes datos={crecimiento?.miembros_por_mes ?? []} color="#3FB68B" />
        </Seccion>
        <Seccion titulo="Mensajes por mes">
          <BarrasPorMes datos={crecimiento?.mensajes_por_mes ?? []} color="#FF6B5B" />
        </Seccion>
      </div>
    </div>
  )
}
