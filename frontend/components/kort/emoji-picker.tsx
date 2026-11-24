'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export const EMOJIS_RAPIDOS = ['👍', '❤️', '😂', '🔥', '😮', '😢', '🎉', '👀']

const GRUPOS: { nombre: string; emojis: string[] }[] = [
  {
    nombre: 'Caras',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '😴', '😷', '🤒', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '😮', '😲', '😳', '🥺', '😢', '😭', '😱', '😤', '😡', '🤬', '💀', '🤡', '👻', '👽', '🤖', '💩'],
  },
  {
    nombre: 'Gestos',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '👋', '👏', '🙌', '👐', '🤝', '🙏', '💪', '🫡', '🫶', '👀', '🧠', '🫠'],
  },
  {
    nombre: 'Símbolos',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💯', '✨', '⭐', '🔥', '💥', '💫', '💤', '✅', '❌', '❓', '❗', '⚠️', '🆗', '🆒', '🆕'],
  },
  {
    nombre: 'Cosas',
    emojis: ['🎉', '🎊', '🎁', '🏆', '🥇', '⚽', '🏀', '🎮', '🕹️', '🎲', '🎧', '🎵', '🎸', '📚', '✏️', '💻', '📱', '📷', '🍕', '🍔', '🍟', '🌮', '🍩', '☕', '🍺', '🧉', '🚀', '🌈', '☀️', '🌙', '🐶', '🐱'],
  },
]

/** Botón que abre un panel con emojis. Llama a onElegir con el emoji elegido. */
export function EmojiPicker({
  onElegir,
  children,
  className,
  alinear = 'derecha',
  etiqueta = 'Elegir emoji',
}: {
  onElegir: (emoji: string) => void
  children: React.ReactNode
  className?: string
  alinear?: 'derecha' | 'izquierda'
  etiqueta?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function alClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    function alTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClick)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClick)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={etiqueta}
        title={etiqueta}
        aria-expanded={abierto}
        className={className}
      >
        {children}
      </button>
      {abierto && (
        <div
          role="dialog"
          aria-label="Emojis"
          className={cn(
            'absolute bottom-full z-50 mb-2 w-72 rounded-xl border border-border bg-elevated p-2 shadow-xl shadow-black/40',
            alinear === 'derecha' ? 'right-0' : 'left-0',
          )}
        >
          <div className="scrollbar-thin flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {GRUPOS.map((g) => (
              <div key={g.nombre}>
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.nombre}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {g.emojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onElegir(e)
                        setAbierto(false)
                      }}
                      className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-border/60"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
