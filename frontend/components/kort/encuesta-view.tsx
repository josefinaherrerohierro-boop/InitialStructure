'use client'

import { useState } from 'react'
import { BarChart3, Check, Clock } from 'lucide-react'
import { mensajeDeError, votarEncuesta, type Encuesta, type Mensaje } from '@/lib/api'
import { horaMensaje } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { useToast } from './toast-provider'

/** Encuesta dentro de un mensaje: votar, cambiar el voto y ver resultados. */
export function EncuestaView({
  encuesta,
  pregunta,
  onActualizado,
}: {
  encuesta: Encuesta
  pregunta: string
  onActualizado: (m: Mensaje) => void
}) {
  const toast = useToast()
  const [ocupado, setOcupado] = useState(false)
  const yaVote = encuesta.mis_votos.length > 0
  const mostrarResultados = yaVote || encuesta.cerrada

  async function votar(ids: number[]) {
    setOcupado(true)
    try {
      onActualizado(await votarEncuesta(encuesta.id, ids))
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  function alElegir(opcionId: number) {
    if (encuesta.cerrada || ocupado) return
    const elegida = encuesta.mis_votos.includes(opcionId)
    if (encuesta.multiple) {
      votar(elegida ? encuesta.mis_votos.filter((id) => id !== opcionId) : [...encuesta.mis_votos, opcionId])
    } else {
      votar(elegida ? [] : [opcionId])
    }
  }

  const maximo = Math.max(1, ...encuesta.opciones.map((o) => o.votos))

  return (
    <div className="mt-1.5 w-full max-w-md rounded-xl border border-border bg-surface p-3.5">
      <div className="mb-3 flex items-start gap-2">
        <BarChart3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="font-semibold leading-snug">{pregunta}</p>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        {encuesta.multiple ? 'Podés elegir varias opciones' : 'Elegí una opción'}
      </p>
      <ul className="flex flex-col gap-1.5">
        {encuesta.opciones.map((o) => {
          const elegida = encuesta.mis_votos.includes(o.id)
          const porcentaje = encuesta.total_votantes ? Math.round((o.votos / encuesta.total_votantes) * 100) : 0
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={encuesta.cerrada || ocupado}
                onClick={() => alElegir(o.id)}
                aria-pressed={elegida}
                className={cn(
                  'relative flex w-full items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  elegida ? 'border-primary/60' : 'border-border hover:border-primary/40',
                  encuesta.cerrada && 'cursor-default',
                )}
              >
                {mostrarResultados && (
                  <span
                    aria-hidden
                    className={cn('absolute inset-y-0 left-0', o.votos === maximo && o.votos > 0 ? 'bg-primary/20' : 'bg-elevated')}
                    style={{ width: `${porcentaje}%` }}
                  />
                )}
                <span
                  className={cn(
                    'relative flex size-4 shrink-0 items-center justify-center border',
                    encuesta.multiple ? 'rounded' : 'rounded-full',
                    elegida ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/60',
                  )}
                >
                  {elegida && <Check className="size-3" aria-hidden />}
                </span>
                <span className="relative flex-1">{o.texto}</span>
                {mostrarResultados && (
                  <span className="relative text-xs tabular-nums text-muted-foreground">
                    {o.votos} · {porcentaje}%
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>
          {encuesta.total_votantes} {encuesta.total_votantes === 1 ? 'voto' : 'votos'}
        </span>
        {encuesta.fecha_limite ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {encuesta.cerrada ? 'Cerró' : 'Cierra'} {horaMensaje(encuesta.fecha_limite)}
          </span>
        ) : (
          <span>· Sin fecha límite</span>
        )}
        {yaVote && !encuesta.cerrada && (
          <button type="button" onClick={() => votar([])} className="ml-auto text-primary hover:underline">
            Sacar mi voto
          </button>
        )}
      </p>
    </div>
  )
}
