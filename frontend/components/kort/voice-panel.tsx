'use client'

import useSWR from 'swr'
import { Headphones, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { getParticipantesVoz, type Canal, type Usuario } from '@/lib/api'
import type { Voz } from '@/lib/use-voz'
import { cn } from '@/lib/utils'
import { Avatar, Boton, ErrorFormulario } from './ui'

/** Pantalla de un canal de voz: entrar, ver quién habla, silenciarse y salir. */
export function VoicePanel({ canal, yo, voz }: { canal: Canal; yo: Usuario; voz: Voz }) {
  const enEsteCanal = voz.canal?.id === canal.id
  const conectado = enEsteCanal && voz.estado === 'conectado'

  // Mientras no estoy adentro, muestro quiénes están conectados (se actualiza cada 3 s).
  const { data: presentes } = useSWR(
    !conectado ? ['voz', canal.id] : null,
    () => getParticipantesVoz(canal.id),
    { refreshInterval: 3000, onError: () => {} },
  )

  if (conectado) {
    const todos = [{ usuario_id: yo.id, username: yo.username, silenciado: voz.silenciado }, ...voz.participantes]
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-thin flex flex-1 flex-wrap content-center items-center justify-center gap-4 overflow-y-auto p-6">
          {todos.map((p) => {
            const habla = !p.silenciado && voz.hablando[p.usuario_id]
            return (
              <div
                key={p.usuario_id}
                className={cn(
                  'flex w-40 flex-col items-center gap-3 rounded-2xl border bg-surface p-5 transition-all',
                  habla ? 'border-success ring-2 ring-success/40' : 'border-border',
                )}
              >
                <Avatar nombre={p.username} tamanio="lg" />
                <div className="flex max-w-full items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{p.username}</span>
                  {p.usuario_id === yo.id && <span className="font-normal text-muted-foreground">(vos)</span>}
                  {p.silenciado && <MicOff className="size-3.5 shrink-0 text-destructive" aria-label="Silenciado" />}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-border p-4">
          {voz.participantes.length === 0 && (
            <p className="text-sm text-muted-foreground">Por ahora estás solo. Cuando alguien entre, lo vas a escuchar.</p>
          )}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={voz.alternarSilencio}>
              {voz.silenciado ? <MicOff className="size-4 text-destructive" aria-hidden /> : <Mic className="size-4" aria-hidden />}
              {voz.silenciado ? 'Activar micrófono' : 'Silenciarme'}
            </Boton>
            <Boton variante="peligro" onClick={voz.salir}>
              <PhoneOff className="size-4" aria-hidden />
              Salir
            </Boton>
          </div>
        </div>
      </div>
    )
  }

  const conectando = enEsteCanal && voz.estado === 'conectando'
  const enOtroCanal = voz.canal !== null && !enEsteCanal

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Volume2 className="size-7" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{canal.nombre}</h2>
          <p className="text-sm text-muted-foreground">Canal de voz</p>
        </div>

        {presentes && presentes.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-2">
            {presentes.map((p) => (
              <li key={p.usuario_id} className="flex items-center gap-1.5 rounded-lg bg-elevated px-2 py-1 text-xs">
                <Avatar nombre={p.username} tamanio="sm" />
                {p.username}
                {p.silenciado && <MicOff className="size-3 text-destructive" aria-label="Silenciado" />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No hay nadie conectado todavía.</p>
        )}

        {enEsteCanal && <ErrorFormulario mensaje={voz.error} />}
        {enOtroCanal && (
          <p className="text-sm text-muted-foreground">Ahora estás en {voz.canal?.nombre}. Si entrás acá, salís de ese canal.</p>
        )}

        <Boton cargando={conectando} onClick={() => voz.entrar({ id: canal.id, nombre: canal.nombre }, yo.id)}>
          <Mic className="size-4" aria-hidden />
          Entrar al canal de voz
        </Boton>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Headphones className="size-3.5" aria-hidden />
          Usá auriculares para que no se acople el sonido.
        </p>
      </div>
    </div>
  )
}

/** Barrita fija en la barra lateral mientras estás en una llamada (aunque mires otro canal). */
export function VozBar({ voz }: { voz: Voz }) {
  if (voz.estado !== 'conectado' || !voz.canal) return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-2.5">
      <Volume2 className="size-4 shrink-0 text-success" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-success">Conectado a la voz</p>
        <p className="truncate text-xs text-muted-foreground">{voz.canal.nombre}</p>
      </div>
      <button
        type="button"
        onClick={voz.alternarSilencio}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground"
        aria-label={voz.silenciado ? 'Activar micrófono' : 'Silenciarme'}
        title={voz.silenciado ? 'Activar micrófono' : 'Silenciarme'}
      >
        {voz.silenciado ? <MicOff className="size-4 text-destructive" /> : <Mic className="size-4" />}
      </button>
      <button
        type="button"
        onClick={voz.salir}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        aria-label="Salir del canal de voz"
        title="Salir del canal de voz"
      >
        <PhoneOff className="size-4" />
      </button>
    </div>
  )
}
