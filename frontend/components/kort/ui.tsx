'use client'

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorDesdeNombre, iniciales } from '@/lib/kort'
import { urlArchivo } from '@/lib/api'

/** Ícono de Kort: una "k" geométrica sobre un cuadrado redondeado. */
export function LogoMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="10" className="fill-primary" />
      <path d="M11.5 8.5v15" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M21.5 8.5 14.5 16l7 7.5" fill="none" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.5" cy="16" r="1.9" fill="white" opacity="0.85" />
    </svg>
  )
}

/** Logo completo: ícono + "kort" en la tipografía de títulos. El tamaño lo da text-*. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex select-none items-center gap-2 text-2xl text-foreground', className)}>
      <LogoMarca className="size-[1.25em]" />
      <span className="font-display font-extrabold tracking-tight">kort</span>
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
        'inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
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
          'h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/20 aria-invalid:border-destructive',
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

export function Avatar({
  nombre,
  url,
  tamanio = 'md',
  className,
}: {
  nombre: string
  url?: string | null
  tamanio?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const color = colorDesdeNombre(nombre)
  const clases = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-semibold',
    tamanio === 'sm' && 'size-7 text-[11px]',
    tamanio === 'md' && 'size-9 text-xs',
    tamanio === 'lg' && 'size-12 text-base',
    tamanio === 'xl' && 'size-24 rounded-2xl text-2xl',
    className,
  )
  const src = urlArchivo(url)
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" aria-hidden className={cn(clases, 'object-cover')} />
  }
  return (
    <span aria-hidden className={clases} style={{ backgroundColor: `${color}26`, color }}>
      {iniciales(nombre)}
    </span>
  )
}
