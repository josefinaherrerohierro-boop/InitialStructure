'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Crown, Gamepad2, Medal, Trophy } from 'lucide-react'
import { darPuntos, getMovimientosPuntos, getScoreboard, mensajeDeError, type Miembro, type Puntaje } from '@/lib/api'
import { horaMensaje, type Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Seccion } from './config/confirmar'
import { useToast } from './toast-provider'
import { Avatar, Boton, ErrorFormulario, Input } from './ui'

const PODIO = [
  { clase: 'h-28 bg-warning/20 text-warning', icono: Crown, orden: 'order-2' },
  { clase: 'h-20 bg-muted-foreground/15 text-muted-foreground', icono: Medal, orden: 'order-1' },
  { clase: 'h-14 bg-[#c98b4b]/20 text-[#c98b4b]', icono: Medal, orden: 'order-3' },
]

function Podio({ top, onVerPerfil }: { top: Puntaje[]; onVerPerfil?: (id: number) => void }) {
  return (
    <div className="flex items-end justify-center gap-3 pt-4">
      {top.map((p, i) => {
        const estilo = PODIO[i]
        return (
          <button
            key={p.usuario.id}
            type="button"
            onClick={() => onVerPerfil?.(p.usuario.id)}
            className={cn('flex w-28 flex-col items-center gap-2', estilo.orden)}
          >
            <estilo.icono className={cn('size-5', estilo.clase.split(' ').at(-1))} aria-hidden />
            <Avatar nombre={p.usuario.username} url={p.usuario.avatar_url} tamanio="lg" />
            <span className="w-full truncate text-center text-sm font-medium">{p.apodo || p.usuario.username}</span>
            <span className={cn('flex w-full flex-col items-center justify-start rounded-t-xl pt-2', estilo.clase)}>
              <span className="text-xl font-bold tabular-nums">{p.puntos}</span>
              <span className="text-[10px] uppercase">puntos</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function DarPuntos({
  servidorId,
  miembros,
  miId,
  esDuenio,
  onDado,
}: {
  servidorId: number
  miembros: Miembro[]
  miId: number
  esDuenio: boolean
  onDado: () => void
}) {
  const toast = useToast()
  const [usuario, setUsuario] = useState('')
  const [cantidad, setCantidad] = useState('10')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function dar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await darPuntos(servidorId, { usuario_id: Number(usuario), cantidad: Number(cantidad), motivo: motivo.trim() })
      toast.exito('Puntos actualizados.')
      setMotivo('')
      onDado()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Seccion titulo="Dar o quitar puntos" descripcion="Solo moderadores. Usá un número negativo para restar.">
      <form onSubmit={dar} className="grid gap-2 sm:grid-cols-[1fr_6rem_1fr_auto]">
        <select
          aria-label="Miembro"
          required
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="h-11 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Elegí un miembro</option>
          {miembros
            .filter((m) => esDuenio || m.usuario_id !== miId)
            .map((m) => (
              <option key={m.usuario_id} value={m.usuario_id}>
                {m.apodo || m.username}
              </option>
            ))}
        </select>
        <Input aria-label="Cantidad" type="number" min={-1000} max={1000} required value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        <Input aria-label="Motivo" maxLength={100} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ej.: ganó el torneo)" />
        <Boton type="submit" cargando={cargando} disabled={!usuario || !Number(cantidad)}>
          Dar
        </Boton>
      </form>
      <ErrorFormulario mensaje={error} />
    </Seccion>
  )
}

export function ScoreboardView({
  servidorId,
  miId,
  miembros,
  permisos,
  onVerPerfil,
}: {
  servidorId: number
  miId: number
  miembros: Miembro[]
  permisos: Permisos
  onVerPerfil?: (id: number) => void
}) {
  const { data: tabla, mutate } = useSWR(['scoreboard', servidorId], () => getScoreboard(servidorId), { refreshInterval: 15000 })
  const { data: movimientos, mutate: mutateMov } = useSWR(['puntos', servidorId], () => getMovimientosPuntos(servidorId), {
    refreshInterval: 15000,
  })
  const top = (tabla ?? []).slice(0, 3)

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <Trophy className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Scoreboard</h2>
            <p className="text-sm text-muted-foreground">
              Los puntos los dan los moderadores o se ganan jugando en las llamadas. Si hay empate, cuentan las tareas hechas y los mensajes del último mes.
            </p>
          </div>
        </div>

        {/* El podio aparece recién cuando alguien sumó puntos. */}
        {top.some((p) => p.puntos > 0) ? (
          <Podio top={top.filter((p) => p.puntos > 0)} onVerPerfil={onVerPerfil} />
        ) : (
          tabla && (
            <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Todavía nadie sumó puntos. El podio aparece cuando alguien gane un juego en una llamada o un moderador dé puntos.
            </p>
          )
        )}

        <ol className="flex flex-col overflow-hidden rounded-xl border border-border">
          <li className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_4.5rem] gap-2 bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground">
            <span>#</span>
            <span>Miembro</span>
            <span className="text-right">Puntos</span>
            <span className="text-right">Tareas</span>
            <span className="text-right">Msjs</span>
          </li>
          {tabla?.map((p) => (
            <li
              key={p.usuario.id}
              className={cn(
                'grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_4.5rem] items-center gap-2 border-t border-border px-3 py-2 text-sm',
                p.usuario.id === miId && 'bg-primary/8',
              )}
            >
              <span className="font-semibold tabular-nums text-muted-foreground">{p.posicion}</span>
              <button type="button" onClick={() => onVerPerfil?.(p.usuario.id)} className="flex min-w-0 items-center gap-2 text-left">
                <Avatar nombre={p.usuario.username} url={p.usuario.avatar_url} tamanio="sm" />
                <span className="truncate">
                  {p.apodo || p.usuario.username}
                  {p.usuario.id === miId && <span className="text-muted-foreground"> (vos)</span>}
                </span>
              </button>
              <span className="text-right font-semibold tabular-nums">{p.puntos}</span>
              <span className="text-right tabular-nums text-muted-foreground">{p.tareas_hechas}</span>
              <span className="text-right tabular-nums text-muted-foreground">{p.mensajes_30_dias}</span>
            </li>
          ))}
        </ol>

        {permisos.esModerador && (
          <DarPuntos
            servidorId={servidorId}
            miembros={miembros}
            miId={miId}
            esDuenio={permisos.esDuenio}
            onDado={() => {
              mutate()
              mutateMov()
            }}
          />
        )}

        {movimientos && movimientos.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Últimos movimientos</h3>
            <ul className="flex flex-col gap-1">
              {movimientos.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                  <span className={cn('w-12 shrink-0 font-semibold tabular-nums', m.cantidad > 0 ? 'text-success' : 'text-destructive')}>
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{m.usuario.username}</span>
                    {m.motivo && <span className="text-muted-foreground"> · {m.motivo}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {m.otorgado_por ? `por ${m.otorgado_por.username}` : <><Gamepad2 className="size-3" aria-hidden /> juego</>}
                    {' · '}
                    {horaMensaje(m.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
