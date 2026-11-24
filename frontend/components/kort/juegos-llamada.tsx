'use client'

import { Circle, Gamepad2, Hand, Scissors, Square, Trophy, X } from 'lucide-react'
import type { Voz } from '@/lib/use-voz'
import { cn } from '@/lib/utils'
import { Boton } from './ui'

const PPT = [
  { valor: 'piedra', emoji: '✊', nombre: 'Piedra' },
  { valor: 'papel', emoji: '✋', nombre: 'Papel' },
  { valor: 'tijera', emoji: '✌️', nombre: 'Tijera' },
]

const JUEGOS = [
  { id: 'tateti', nombre: 'Ta-te-ti', descripcion: 'Tres en línea, por turnos. El que gana suma 3 puntos.', Icono: Square },
  { id: 'ppt', nombre: 'Piedra, papel o tijera', descripcion: 'Al mejor de 3. El que gana suma 2 puntos.', Icono: Scissors },
]

/** Juegos dentro de la llamada. Las reglas las controla el servidor. */
export function JuegosLlamada({ voz, miId }: { voz: Voz; miId: number }) {
  const juego = voz.juego
  const nombreDe = (id: number | null | undefined) =>
    juego?.jugadores.find((j) => j.usuario_id === id)?.username ?? '?'
  const soyJugador = !!juego?.jugadores.some((j) => j.usuario_id === miId)

  if (!juego) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Gamepad2 className="size-6" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Juegos en la llamada</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Elegí un juego y esperá a que alguien de la llamada se una. Los puntos van al scoreboard del servidor.
          </p>
        </div>
        <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
          {JUEGOS.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => voz.accionJuego({ accion: 'crear', juego: j.id })}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/50"
            >
              <j.Icono className="size-5 text-primary" aria-hidden />
              <span className="font-semibold">{j.nombre}</span>
              <span className="text-xs text-muted-foreground">{j.descripcion}</span>
            </button>
          ))}
        </div>
        {voz.avisoJuego && <p className="text-sm text-warning">{voz.avisoJuego}</p>}
      </div>
    )
  }

  const [j1, j2] = juego.jugadores

  return (
    <div className="flex flex-1 flex-col items-center gap-5 overflow-y-auto p-6">
      <div className="flex w-full max-w-md items-center justify-between gap-3">
        <h2 className="font-semibold capitalize">{juego.nombre}</h2>
        {(soyJugador || juego.estado === 'terminado') && (
          <Boton variante="fantasma" className="h-8 px-2 text-xs" onClick={() => voz.accionJuego({ accion: 'cancelar' })}>
            <X className="size-3.5" aria-hidden />
            {juego.estado === 'terminado' ? 'Cerrar' : 'Cancelar juego'}
          </Boton>
        )}
      </div>

      <div className="flex w-full max-w-md items-center justify-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {juego.tipo === 'tateti' && <X className="size-4 text-primary" aria-hidden />}
          {j1.username}
          {juego.tipo === 'ppt' && <span className="tabular-nums text-muted-foreground">({juego.marcador?.[j1.usuario_id] ?? 0})</span>}
        </span>
        <span className="text-muted-foreground">vs</span>
        <span className="flex items-center gap-1.5 font-medium">
          {juego.tipo === 'tateti' && <Circle className="size-3.5 text-success" aria-hidden />}
          {j2?.username ?? 'esperando rival…'}
          {juego.tipo === 'ppt' && j2 && (
            <span className="tabular-nums text-muted-foreground">({juego.marcador?.[j2.usuario_id] ?? 0})</span>
          )}
        </span>
      </div>

      {juego.estado === 'esperando' &&
        (soyJugador ? (
          <p className="text-sm text-muted-foreground">Esperando que alguien de la llamada se una…</p>
        ) : (
          <Boton onClick={() => voz.accionJuego({ accion: 'unirse' })}>Jugar contra {j1.username}</Boton>
        ))}

      {juego.tipo === 'tateti' && juego.estado !== 'esperando' && juego.tablero && (
        <>
          {juego.estado === 'jugando' && (
            <p className="text-sm" aria-live="polite">
              {juego.turno === miId ? <strong className="text-primary">¡Te toca!</strong> : `Turno de ${nombreDe(juego.turno)}`}
            </p>
          )}
          <div className="grid grid-cols-3 gap-2" role="grid" aria-label="Tablero de ta-te-ti">
            {juego.tablero.map((celda, i) => {
              const ganadora = juego.linea_ganadora?.includes(i)
              const puedo = juego.estado === 'jugando' && juego.turno === miId && celda === null
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => voz.accionJuego({ accion: 'jugar', casilla: i })}
                  disabled={!puedo}
                  aria-label={`Casilla ${i + 1}${celda ? `: ${nombreDe(celda)}` : ''}`}
                  className={cn(
                    'flex size-20 items-center justify-center rounded-xl border-2 bg-surface transition-colors sm:size-24',
                    ganadora ? 'border-primary bg-primary/15' : 'border-border',
                    puedo && 'hover:border-primary/50',
                  )}
                >
                  {celda === j1.usuario_id && <X className="size-10 text-primary" aria-hidden />}
                  {celda !== null && celda === j2?.usuario_id && <Circle className="size-9 text-success" aria-hidden />}
                </button>
              )
            })}
          </div>
        </>
      )}

      {juego.tipo === 'ppt' && juego.estado !== 'esperando' && j2 && (
        <div className="flex flex-col items-center gap-4">
          {juego.ultima_ronda && (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-2 text-sm">
              <span>
                {j1.username}: {PPT.find((p) => p.valor === juego.ultima_ronda!.elecciones[j1.usuario_id])?.emoji}
              </span>
              <span className="text-muted-foreground">
                {juego.ultima_ronda.ganador ? `ronda para ${nombreDe(juego.ultima_ronda.ganador)}` : 'empate'}
              </span>
              <span>
                {PPT.find((p) => p.valor === juego.ultima_ronda!.elecciones[j2.usuario_id])?.emoji} :{j2.username}
              </span>
            </div>
          )}
          {juego.estado === 'jugando' &&
            (soyJugador ? (
              juego.ya_eligieron?.includes(miId) ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hand className="size-4" aria-hidden />
                  Ya elegiste. Esperando a {nombreDe(juego.jugadores.find((j) => j.usuario_id !== miId)?.usuario_id)}…
                </p>
              ) : (
                <div className="flex gap-3">
                  {PPT.map((p) => (
                    <button
                      key={p.valor}
                      type="button"
                      onClick={() => voz.accionJuego({ accion: 'jugar', eleccion: p.valor })}
                      className="flex w-24 flex-col items-center gap-1 rounded-2xl border-2 border-border bg-surface py-4 transition-colors hover:border-primary/60"
                    >
                      <span className="text-4xl" aria-hidden>
                        {p.emoji}
                      </span>
                      <span className="text-sm">{p.nombre}</span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {(juego.ya_eligieron?.length ?? 0) === 1 ? 'Uno ya eligió…' : 'Eligiendo…'}
              </p>
            ))}
        </div>
      )}

      {juego.estado === 'terminado' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-6 py-4 text-center">
          <Trophy className="size-7 text-warning" aria-hidden />
          <p className="font-semibold">
            {juego.empate ? '¡Empate!' : juego.ganador === miId ? '¡Ganaste!' : `Ganó ${nombreDe(juego.ganador)}`}
          </p>
          {!juego.empate && <p className="text-xs text-muted-foreground">+{juego.puntos_por_ganar} puntos en el scoreboard</p>}
          <Boton className="h-9" onClick={() => voz.accionJuego({ accion: 'crear', juego: juego.tipo })}>
            Jugar otra vez
          </Boton>
        </div>
      )}

      {voz.avisoJuego && <p className="text-sm text-warning">{voz.avisoJuego}</p>}
    </div>
  )
}
