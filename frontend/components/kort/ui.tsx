'use client'

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorDesdeNombre, iniciales } from '@/lib/kort'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('select-none text-2xl font-semibold tracking-tight text-foreground', className)}>
      kort<span className="text-primary">•</span>
    </span>
  )
}

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

export const Boton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }
>(function Boton({ variante = 'primario', cargando, className, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || cargando}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
        variante === 'primario' && 'bg-primary text-primary-foreground hover:bg-primary-hover',
        variante === 'secundario' && 'border border-border bg-elevated text-foreground hover:bg-border/60',
        variante === 'fantasma' && 'text-muted-foreground hover:bg-elevated hover:text-foreground',
        variante === 'peligro' && 'bg-destructive/15 text-destructive hover:bg-destructive/25',
        className,
      )}
      {...props}
    >
      {cargando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/20 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      />
    )
  },
)

export function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string
  etiqueta: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {etiqueta}
      </label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-xs leading-relaxed text-muted-foreground">
          {ayuda}
        </p>
      )}
    </div>
  )
}

export function ErrorFormulario({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
      {mensaje}
    </p>
  )
}

export function Avatar({ nombre, tamanio = 'md', className }: { nombre: string; tamanio?: 'sm' | 'md' | 'lg'; className?: string }) {
  const color = colorDesdeNombre(nombre)
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold',
        tamanio === 'sm' && 'size-7 text-[11px]',
        tamanio === 'md' && 'size-9 text-xs',
        tamanio === 'lg' && 'size-12 text-base',
        className,
      )}
      style={{ backgroundColor: `${color}26`, color }}
    >
      {iniciales(nombre)}
    </span>
  )
}
