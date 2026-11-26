'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Phone, PhoneOff } from 'lucide-react'
import { getLlamadasEntrantes, type ParticipanteVoz } from '@/lib/api'
import type { Voz } from '@/lib/use-voz'
import { Avatar } from './ui'

/** Un "ring ring" cortito con el navegador (sin archivos de audio). */
function sonar() {
  try {
    const ctx = new AudioContext()
    for (const [inicio, frecuencia] of [
      [0, 880],
      [0.18, 660],
      [0.6, 880],
      [0.78, 660],
    ] as const) {
      const osc = ctx.createOscillator()
      const volumen = ctx.createGain()
      osc.frequency.value = frecuencia
      volumen.gain.setValueAtTime(0.0001, ctx.currentTime + inicio)
      volumen.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + inicio + 0.02)
      volumen.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.16)
      osc.connect(volumen).connect(ctx.destination)
      osc.start(ctx.currentTime + inicio)
      osc.stop(ctx.currentTime + inicio + 0.17)
    }
    setTimeout(() => ctx.close(), 1500)
  } catch {
    // Sin audio (el navegador no lo permite todavía): queda solo el aviso.
  }
}

/** Aviso flotante cuando alguien te llama por mensaje directo. */
export function LlamadasEntrantes({ voz, onAtender }: { voz: Voz; onAtender: (p: ParticipanteVoz) => void }) {
  const { data } = useSWR('llamadas-entrantes', getLlamadasEntrantes, { refreshInterval: 3000, onError: () => {} })
  const [ignoradas, setIgnoradas] = useState<number[]>([])
  const sonadas = useRef(new Set<number>())

  // No avisamos de la llamada en la que ya estás, ni de las que dijiste "Ahora no".
  const llamando = (data ?? []).filter(
    (p) => !ignoradas.includes(p.usuario_id) && !(voz.canal?.directo && voz.canal.id === p.usuario_id),
  )

  // Cuando una llamada termina, se olvida que la habías ignorado (la próxima vuelve a sonar).
  useEffect(() => {
    if (!data) return
    const activas = new Set(data.map((p) => p.usuario_id))
    setIgnoradas((prev) => (prev.some((id) => !activas.has(id)) ? prev.filter((id) => activas.has(id)) : prev))
    for (const id of [...sonadas.current]) if (!activas.has(id)) sonadas.current.delete(id)
  }, [data])

  // Suena una vez por cada llamada nueva.
  useEffect(() => {
    for (const p of llamando) {
      if (!sonadas.current.has(p.usuario_id)) {
        sonadas.current.add(p.usuario_id)
        sonar()
      }
    }
  })

  if (llamando.length === 0) return null
  return (
    <div className="fixed top-20 right-5 z-50 flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2" aria-live="assertive">
      {llamando.map((p) => (
        <div
          key={p.usuario_id}
          role="alertdialog"
          aria-label={`${p.username} te está llamando`}
          className="aparecer-arriba flex items-center gap-3 rounded-2xl border border-success/40 bg-surface p-3 shadow-[var(--sombra)]"
        >
          <span className="relative">
            <Avatar nombre={p.username} />
            <span className="absolute -inset-1 animate-ping rounded-full border-2 border-success/60" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.username}</p>
            <p className="text-xs text-muted-foreground">Te está llamando…</p>
          </div>
          <button
            type="button"
            onClick={() => setIgnoradas((prev) => [...prev, p.usuario_id])}
            className="flex size-9 items-center justify-center rounded-full bg-destructive text-white hover:bg-destructive/85"
            aria-label="Ahora no"
            title="Ahora no"
          >
            <PhoneOff className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onAtender(p)}
            className="flex size-9 items-center justify-center rounded-full bg-success text-white hover:bg-success/85"
            aria-label="Atender"
            title="Atender"
          >
            <Phone className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
