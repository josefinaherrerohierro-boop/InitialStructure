'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { guardarPreferencias, mensajeDeError } from '@/lib/api'
import {
  aplicarApariencia,
  COLORES_SUGERIDOS,
  FUENTES,
  PREFERENCIAS_POR_DEFECTO,
  TEMAS,
  type Preferencias,
} from '@/lib/apariencia'
import { cn } from '@/lib/utils'
import { Interruptor, Seccion } from '../config/confirmar'
import { useToast } from '../toast-provider'
import { Avatar, Boton } from '../ui'

/**
 * Cambiar colores, tipografía y tamaño de letra. Cada cambio se ve al
 * instante y se guarda solo en la cuenta (medio segundo después).
 */
export function AparienciaTab({ inicial, onGuardado }: { inicial: Preferencias; onGuardado: (p: Preferencias) => void }) {
  const toast = useToast()
  const [prefs, setPrefs] = useState<Preferencias>(inicial)
  const [estado, setEstado] = useState<'guardado' | 'guardando' | null>(null)
  const temporizador = useRef<number | null>(null)

  function cambiar(cambios: Partial<Preferencias>) {
    const nuevas = { ...prefs, ...cambios }
    setPrefs(nuevas)
    aplicarApariencia(nuevas)
    setEstado('guardando')
    if (temporizador.current) window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(async () => {
      try {
        onGuardado(await guardarPreferencias(nuevas))
        setEstado('guardado')
      } catch (err) {
        setEstado(null)
        toast.error(mensajeDeError(err))
      }
    }, 500)
  }

  useEffect(() => () => {
    if (temporizador.current) window.clearTimeout(temporizador.current)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
        {estado === 'guardando' ? 'Guardando…' : estado === 'guardado' ? 'Guardado en tu cuenta ✓' : ''}
      </p>

      <Seccion titulo="Tema">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => cambiar({ tema: t.id })}
              aria-pressed={prefs.tema === t.id}
              className={cn(
                'flex flex-col gap-2 rounded-xl border-2 p-2 text-left transition-colors',
                prefs.tema === t.id ? 'border-primary' : 'border-border hover:border-muted-foreground/50',
              )}
            >
              <span className="flex h-14 overflow-hidden rounded-lg" style={{ backgroundColor: t.colores[0] }} aria-hidden>
                <span className="w-1/3" style={{ backgroundColor: t.colores[1] }} />
                <span className="flex flex-1 flex-col justify-center gap-1 px-2">
                  <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: t.colores[2], opacity: 0.8 }} />
                  <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: prefs.color_primario }} />
                </span>
              </span>
              <span className="flex items-center justify-between text-sm">
                {t.nombre}
                {prefs.tema === t.id && <Check className="size-4 text-primary" aria-hidden />}
              </span>
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Color principal" descripcion="Se usa en botones, enlaces y lo que está seleccionado.">
        <div className="flex flex-wrap items-center gap-2">
          {COLORES_SUGERIDOS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => cambiar({ color_primario: c })}
              aria-label={`Color ${c}`}
              aria-pressed={prefs.color_primario === c}
              className={cn(
                'flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-surface',
                prefs.color_primario === c && 'ring-2 ring-foreground',
              )}
              style={{ backgroundColor: c }}
            >
              {prefs.color_primario === c && <Check className="size-4 text-white mix-blend-difference" aria-hidden />}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-2 text-sm text-muted-foreground">
            Otro:
            <input
              type="color"
              value={prefs.color_primario}
              onChange={(e) => cambiar({ color_primario: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
            />
          </label>
        </div>
      </Seccion>

      <Seccion titulo="Tipografía">
        <div className="grid gap-2 sm:grid-cols-2">
          {FUENTES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => cambiar({ fuente: f.id })}
              aria-pressed={prefs.fuente === f.id}
              className={cn(
                'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                prefs.fuente === f.id ? 'border-primary bg-primary/8' : 'border-border hover:bg-elevated',
              )}
              style={{
                fontFamily: `var(--font-${f.id === 'geist' ? 'geist-sans' : f.id === 'mono' ? 'geist-mono' : f.id})`,
              }}
            >
              <span>
                <span className="block text-sm">{f.nombre}</span>
                <span className="block text-xs text-muted-foreground">¡Hola! Así se ve el chat 123</span>
              </span>
              {prefs.fuente === f.id && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Tamaño de letra">
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">A</span>
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            value={prefs.tamanio_fuente}
            onChange={(e) => cambiar({ tamanio_fuente: Number(e.target.value) })}
            aria-label="Tamaño de letra"
            className="flex-1 accent-primary"
          />
          <span className="text-lg text-muted-foreground">A</span>
          <span className="w-12 text-right text-sm tabular-nums">{prefs.tamanio_fuente}px</span>
        </div>
      </Seccion>

      <Seccion titulo="Mensajes">
        <Interruptor activo={prefs.compacto} onCambiar={(v) => cambiar({ compacto: v })} etiqueta="Modo compacto (mensajes más juntos)" />
        <div className="rounded-xl border border-border bg-background p-3" aria-hidden>
          <div className={cn('flex gap-3', prefs.compacto ? 'py-0.5' : 'py-1.5')}>
            <Avatar nombre="ana" />
            <div>
              <p className="text-sm font-semibold">
                ana <span className="text-xs font-normal text-muted-foreground">hoy 18:04</span>
              </p>
              <p className="text-sm">¿Les gusta cómo quedó? 🎨</p>
            </div>
          </div>
          <p className="mt-2 text-sm">
            <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Botón</span>{' '}
            <span className="text-primary">un enlace</span>
          </p>
        </div>
      </Seccion>

      <div>
        <Boton variante="fantasma" onClick={() => cambiar(PREFERENCIAS_POR_DEFECTO)}>
          <RotateCcw className="size-4" aria-hidden />
          Volver a la apariencia original
        </Boton>
      </div>
    </div>
  )
}
