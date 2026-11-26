'use client'

/**
 * Campanita de notificaciones (arriba a la derecha).
 *
 * Cada 5 segundos le pregunta a la API si hay avisos nuevos. Los importantes
 * (te mencionaron, te escribieron por privado o te mandaron una solicitud de
 * amistad) hacen un sonidito y muestran un cartel. Los demás (te aceptaron una
 * solicitud, te asignaron una tarea) aparecen en la lista sin sonar.
 *
 * Si el aviso es de lo que ya estás mirando (el canal o la conversación
 * abierta), no suena: se marca como leído solo.
 */

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { AtSign, Bell, BellOff, CheckCheck, ListTodo, MessageCircle, UserCheck, UserPlus, Volume2 } from 'lucide-react'
import { getNotificaciones, leerNotificaciones, type Notificacion, type TipoNotificacion } from '@/lib/api'
import { horaMensaje } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { useToast } from './toast-provider'
import { Avatar } from './ui'

/** Los que suenan. */
const IMPORTANTES: TipoNotificacion[] = ['mencion', 'mensaje_directo', 'solicitud_amistad']

const ICONOS: Record<TipoNotificacion, typeof Bell> = {
  mencion: AtSign,
  mensaje_directo: MessageCircle,
  solicitud_amistad: UserPlus,
  amistad_aceptada: UserCheck,
  tarea_asignada: ListTodo,
}

const CLAVE_SILENCIO = 'kort_notificaciones_silenciadas'

/** Un "ding" corto generado con el navegador (no hace falta ningún archivo de audio). */
let contextoAudio: AudioContext | null = null
function sonar() {
  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Contexto) return
    contextoAudio ??= new Contexto()
    const ctx = contextoAudio
    if (ctx.state === 'suspended') void ctx.resume()
    const ahora = ctx.currentTime
    // Dos notas cortas, una más aguda que la otra.
    ;[
      { frecuencia: 880, inicio: 0 },
      { frecuencia: 1320, inicio: 0.12 },
    ].forEach(({ frecuencia, inicio }) => {
      const osc = ctx.createOscillator()
      const volumen = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frecuencia
      volumen.gain.setValueAtTime(0.0001, ahora + inicio)
      volumen.gain.exponentialRampToValueAtTime(0.18, ahora + inicio + 0.02)
      volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + inicio + 0.25)
      osc.connect(volumen).connect(ctx.destination)
      osc.start(ahora + inicio)
      osc.stop(ahora + inicio + 0.3)
    })
  } catch {
    // Si el navegador no deja reproducir sonido, el aviso igual aparece en pantalla.
  }
}

/** Clave que cambia si el aviso es nuevo o si se actualizó (los mensajes privados se agrupan en uno). */
const claveDe = (n: Notificacion) => `${n.id}-${n.fecha}`

export function Notificaciones({
  activo,
  estaMirando,
  onAbrir,
}: {
  activo: boolean
  /** true si el aviso es de lo que el usuario tiene abierto ahora (no suena y se marca como leído). */
  estaMirando: (n: Notificacion) => boolean
  /** Lleva al lugar del aviso (el canal, la conversación, amigos o tareas). */
  onAbrir: (n: Notificacion) => void
}) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [silenciado, setSilenciado] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // Avisos que ya vimos (para sonar solo con los nuevos). null = todavía no cargó la primera vez.
  const vistos = useRef<Set<string> | null>(null)

  const { data, mutate } = useSWR(activo ? 'notificaciones' : null, getNotificaciones, {
    refreshInterval: 5000,
    onError: () => {},
  })

  useEffect(() => {
    try {
      setSilenciado(window.localStorage.getItem(CLAVE_SILENCIO) === '1')
    } catch {}
    // Los navegadores solo dejan reproducir sonido después de que el usuario
    // tocó algo en la página: con el primer clic "despertamos" el audio.
    const despertar = () => {
      try {
        const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (Contexto) {
          contextoAudio ??= new Contexto()
          void contextoAudio.resume()
        }
      } catch {}
    }
    document.addEventListener('pointerdown', despertar, { once: true })
    return () => document.removeEventListener('pointerdown', despertar)
  }, [])

  // Cada vez que llegan avisos: los nuevos e importantes suenan y muestran un cartel.
  useEffect(() => {
    if (!data) return
    const claves = data.items.map(claveDe)
    if (vistos.current === null) {
      // Primera carga: lo que ya había no suena.
      vistos.current = new Set(claves)
      return
    }
    const nuevos = data.items.filter((n) => !n.leida && !vistos.current!.has(claveDe(n)))
    claves.forEach((c) => vistos.current!.add(c))
    if (nuevos.length === 0) return

    const yaLoEstoyMirando = nuevos.filter(estaMirando)
    if (yaLoEstoyMirando.length) {
      leerNotificaciones(yaLoEstoyMirando.map((n) => n.id))
        .then((d) => mutate(d, { revalidate: false }))
        .catch(() => {})
    }
    const paraAvisar = nuevos.filter((n) => !estaMirando(n) && IMPORTANTES.includes(n.tipo))
    if (paraAvisar.length === 0) return
    if (!silenciado) sonar()
    toast.exito(paraAvisar.length === 1 ? paraAvisar[0].texto : `Tenés ${paraAvisar.length} avisos nuevos.`)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar la lista al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false)
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  function alternarSilencio() {
    const nuevo = !silenciado
    setSilenciado(nuevo)
    try {
      window.localStorage.setItem(CLAVE_SILENCIO, nuevo ? '1' : '0')
    } catch {}
    if (!nuevo) sonar() // para que se escuche cómo suena
  }

  async function abrir(n: Notificacion) {
    setAbierto(false)
    onAbrir(n)
    if (!n.leida) {
      try {
        mutate(await leerNotificaciones([n.id]), { revalidate: false })
      } catch {}
    }
  }

  async function leerTodas() {
    try {
      mutate(await leerNotificaciones(), { revalidate: false })
    } catch {}
  }

  const noLeidas = data?.no_leidas ?? 0

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={noLeidas ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'}
        title="Notificaciones"
        className="relative flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-[var(--sombra)] transition-colors hover:border-primary hover:text-primary"
      >
        <Bell className="size-4" aria-hidden />
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="panel aparecer-arriba absolute top-full right-0 z-50 mt-2 flex max-h-[70vh] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <h2 className="flex-1 text-sm font-semibold">Notificaciones</h2>
            <button
              type="button"
              onClick={alternarSilencio}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground"
              title={silenciado ? 'Activar el sonido' : 'Silenciar el sonido'}
              aria-label={silenciado ? 'Activar el sonido' : 'Silenciar el sonido'}
            >
              {silenciado ? <BellOff className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={leerTodas}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto p-1.5">
            {!data ? (
              <div className="h-24 animate-pulse rounded-xl bg-elevated" aria-hidden />
            ) : data.items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No tenés notificaciones.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {data.items.map((n) => {
                  const Icono = ICONOS[n.tipo] ?? Bell
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => abrir(n)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-elevated',
                          !n.leida && 'bg-primary/8',
                        )}
                      >
                        <span className="relative shrink-0">
                          <Avatar nombre={n.actor?.username ?? 'Kort'} url={n.actor?.avatar_url} tamanio="sm" />
                          <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-surface text-primary ring-2 ring-surface">
                            <Icono className="size-3" aria-hidden />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-sm leading-snug', !n.leida && 'font-medium')}>{n.texto}</span>
                          <span className="text-[11px] text-muted-foreground">{horaMensaje(n.fecha)}</span>
                        </span>
                        {!n.leida && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
