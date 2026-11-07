'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar()
      }}
      aria-labelledby="modal-titulo"
      className="m-auto w-[min(460px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/50 backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      {abierto && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="modal-titulo" className="text-lg font-semibold text-balance">
                {titulo}
              </h2>
              {descripcion && <p className="text-sm leading-relaxed text-muted-foreground">{descripcion}</p>}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
