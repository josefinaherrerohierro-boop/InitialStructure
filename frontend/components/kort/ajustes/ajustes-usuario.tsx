'use client'

import { useEffect, useState } from 'react'
import { History, Palette, Sparkles, UserCircle, UserCog, X } from 'lucide-react'
import type { Usuario } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Avatar } from '../ui'
import { CuentaTab } from './cuenta-tab'
import { HistorialTab } from './historial-tab'
import { PerfilTab } from './perfil-tab'

export type PestaniaAjustes = 'perfil' | 'cuenta' | 'apariencia' | 'historial' | 'wrapped'

/** Configuración del usuario (pantalla completa, con pestañas). */
export function AjustesUsuario({
  usuario,
  inicial = 'perfil',
  onCerrar,
  onActualizado,
  apariencia,
  wrapped,
}: {
  usuario: Usuario
  inicial?: PestaniaAjustes
  onCerrar: () => void
  onActualizado: () => void
  /** Contenido de la pestaña "Apariencia" (si existe). */
  apariencia?: React.ReactNode
  /** Botón/acceso al Wrapped (si existe). */
  wrapped?: React.ReactNode
}) {
  const [actual, setActual] = useState<PestaniaAjustes>(inicial)

  useEffect(() => {
    function alApretar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alApretar)
    return () => window.removeEventListener('keydown', alApretar)
  }, [onCerrar])

  const pestanias = [
    { id: 'perfil' as const, etiqueta: 'Mi perfil', Icono: UserCircle, visible: true },
    { id: 'cuenta' as const, etiqueta: 'Mi cuenta', Icono: UserCog, visible: true },
    { id: 'apariencia' as const, etiqueta: 'Apariencia', Icono: Palette, visible: !!apariencia },
    { id: 'historial' as const, etiqueta: 'Historial de servidores', Icono: History, visible: true },
    { id: 'wrapped' as const, etiqueta: 'Kort Wrapped', Icono: Sparkles, visible: !!wrapped },
  ].filter((p) => p.visible)

  return (
    <div role="dialog" aria-modal="true" aria-label="Configuración de usuario" className="fixed inset-0 z-50 flex flex-col bg-background md:flex-row">
      <nav className="flex shrink-0 flex-col gap-4 border-b border-border bg-surface p-4 md:w-64 md:border-r md:border-b-0">
        <div className="flex items-center gap-3">
          <Avatar nombre={usuario.username} url={usuario.avatar_url} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{usuario.username}</p>
            <p className="text-xs text-muted-foreground">Configuración de usuario</p>
          </div>
        </div>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {pestanias.map(({ id, etiqueta, Icono }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setActual(id)}
                aria-current={actual === id ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  actual === id
                    ? 'bg-primary/12 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
                )}
              >
                <Icono className="size-4" aria-hidden />
                {etiqueta}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-6 md:px-8 md:py-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{pestanias.find((p) => p.id === actual)?.etiqueta}</h2>
            <button
              type="button"
              onClick={onCerrar}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
              Cerrar
            </button>
          </div>

          {actual === 'perfil' && <PerfilTab usuario={usuario} onActualizado={onActualizado} />}
          {actual === 'cuenta' && <CuentaTab key={`${usuario.username}-${usuario.email}`} usuario={usuario} onActualizado={onActualizado} />}
          {actual === 'apariencia' && apariencia}
          {actual === 'historial' && <HistorialTab />}
          {actual === 'wrapped' && wrapped}
        </div>
      </main>
    </div>
  )
}
