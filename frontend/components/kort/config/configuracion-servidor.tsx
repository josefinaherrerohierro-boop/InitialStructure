'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Hash, Settings, Shield, Ticket, Users, X } from 'lucide-react'
import type { Canal, Miembro, Rol, Servidor } from '@/lib/api'
import type { Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Avatar } from '../ui'
import { CanalesTab } from './canales-tab'
import { EstadisticasTab } from './estadisticas-tab'
import { GeneralTab } from './general-tab'
import { InvitacionesTab } from './invitaciones-tab'
import { MiembrosTab } from './miembros-tab'
import { RolesTab } from './roles-tab'

type Pestania = 'general' | 'canales' | 'roles' | 'miembros' | 'invitaciones' | 'estadisticas'

/**
 * Panel de configuración del servidor (pantalla completa, con pestañas).
 * Cada pestaña se muestra solo a quien puede usarla; igual, el backend
 * vuelve a validar todo y devuelve 403 si no corresponde.
 */
export function ConfiguracionServidor({
  servidor,
  permisos,
  miId,
  canales,
  roles,
  miembros,
  onCerrar,
  onActualizar,
  onSalio,
}: {
  servidor: Servidor
  permisos: Permisos
  miId: number
  canales: Canal[]
  roles: Rol[]
  miembros: Miembro[]
  onCerrar: () => void
  onActualizar: () => void
  onSalio: () => void
}) {
  const pestanias: { id: Pestania; etiqueta: string; Icono: typeof Settings; visible: boolean }[] = [
    { id: 'general', etiqueta: 'General', Icono: Settings, visible: true },
    { id: 'canales', etiqueta: 'Canales', Icono: Hash, visible: permisos.esModerador },
    { id: 'roles', etiqueta: 'Roles', Icono: Shield, visible: permisos.esDuenio },
    { id: 'miembros', etiqueta: 'Miembros', Icono: Users, visible: permisos.esModerador },
    { id: 'invitaciones', etiqueta: 'Invitaciones', Icono: Ticket, visible: permisos.puedeInvitar },
    { id: 'estadisticas', etiqueta: 'Estadísticas', Icono: BarChart3, visible: permisos.esDuenio },
  ]
  const visibles = pestanias.filter((p) => p.visible)
  const [actual, setActual] = useState<Pestania>('general')

  // Si se pierden permisos (por ejemplo, después de transferir el servidor),
  // volvemos a "General".
  useEffect(() => {
    if (!visibles.some((p) => p.id === actual)) setActual('general')
  }, [visibles, actual])

  // Cerrar con Escape
  useEffect(() => {
    function alApretar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alApretar)
    return () => window.removeEventListener('keydown', alApretar)
  }, [onCerrar])

  const titulo = visibles.find((p) => p.id === actual)?.etiqueta ?? 'General'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Configuración de ${servidor.nombre}`}
      className="fixed inset-0 z-50 flex flex-col bg-background md:flex-row"
    >
      <nav className="flex shrink-0 flex-col gap-4 border-b border-border bg-surface p-4 md:w-64 md:border-r md:border-b-0">
        <div className="flex items-center gap-3">
          <Avatar nombre={servidor.nombre} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{servidor.nombre}</p>
            <p className="text-xs text-muted-foreground">Configuración</p>
          </div>
        </div>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {visibles.map(({ id, etiqueta, Icono }) => (
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
            <h2 className="text-xl font-semibold">{titulo}</h2>
            <button
              type="button"
              onClick={onCerrar}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
              Cerrar
            </button>
          </div>

          {actual === 'general' && (
            <GeneralTab
              servidor={servidor}
              permisos={permisos}
              miembros={miembros}
              miId={miId}
              onActualizar={onActualizar}
              onSalio={onSalio}
            />
          )}
          {actual === 'canales' && <CanalesTab canales={canales} onActualizar={onActualizar} />}
          {actual === 'roles' && <RolesTab servidorId={servidor.id} roles={roles} onActualizar={onActualizar} />}
          {actual === 'miembros' && (
            <MiembrosTab
              servidorId={servidor.id}
              miembros={miembros}
              roles={roles}
              permisos={permisos}
              miId={miId}
              onActualizar={onActualizar}
            />
          )}
          {actual === 'invitaciones' && <InvitacionesTab servidorId={servidor.id} permisos={permisos} miId={miId} />}
          {actual === 'estadisticas' && <EstadisticasTab servidorId={servidor.id} />}
        </div>
      </main>
    </div>
  )
}
