'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type TipoToast = 'error' | 'exito'
type Toast = { id: number; tipo: TipoToast; texto: string }

type ToastContexto = {
  error: (texto: string) => void
  exito: (texto: string) => void
}

const Contexto = createContext<ToastContexto | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const siguienteId = useRef(1)

  const cerrar = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const agregar = useCallback(
    (tipo: TipoToast, texto: string) => {
      const id = siguienteId.current++
      setToasts((t) => [...t.slice(-3), { id, tipo, texto }])
      window.setTimeout(() => cerrar(id), tipo === 'error' ? 6000 : 3500)
    },
    [cerrar],
  )

  const valor = useMemo<ToastContexto>(
    () => ({ error: (t) => agregar('error', t), exito: (t) => agregar('exito', t) }),
    [agregar],
  )

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-elevated px-4 py-3 text-sm shadow-lg shadow-black/30 animate-in fade-in slide-in-from-bottom-2',
              t.tipo === 'error' ? 'border-destructive/40' : 'border-success/40',
            )}
          >
            {t.tipo === 'error' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            ) : (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            )}
            <p className="flex-1 leading-relaxed text-pretty">{t.texto}</p>
            <button
              type="button"
              onClick={() => cerrar(t.id)}
              className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useToast tiene que usarse dentro de ToastProvider')
  return ctx
}
