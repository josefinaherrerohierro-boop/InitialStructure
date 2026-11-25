'use client'

import { Columns3, Hourglass, Rows3, Settings, UserPlus } from 'lucide-react'
import type { Canal, Servidor } from '@/lib/api'
import type { Permisos } from '@/lib/kort'
import { SeccionesServidor, type Orientacion, type VistaServidor } from './secciones-servidor'
import { tiempoRestante } from './server-selector'
import { Avatar } from './ui'

export { HERRAMIENTAS, type Herramienta, type VistaServidor } from './secciones-servidor'

/**
 * Encabezado de un servidor (arriba del contenido): nombre, acciones y, si
 * las pestañas van en fila, las pestañas. Si van en columna, se dibujan en
 * el panel de la izquierda (ver app-shell).
 */
export function BarraServidor({
  servidor,
  canales,
  canalId,
  vista,
  permisos,
  cantidadMiembros,
  acciones,
  orientacion,
  onCambiarOrientacion,
  onCanal,
  onVista,
  onCrearCanal,
  onInvitar,
  onConfigurar,
}: {
  servidor: Servidor
  canales: Canal[] | undefined
  canalId: number | undefined
  vista: VistaServidor | null
  permisos: Permisos
  cantidadMiembros?: number
  /** Botones extra a la derecha (buscar, multimedia, miembros...). */
  acciones?: React.ReactNode
  orientacion: Orientacion
  onCambiarOrientacion: (o: Orientacion) => void
  onCanal: (id: number) => void
  onVista: (v: VistaServidor) => void
  onCrearCanal: () => void
  onInvitar: () => void
  onConfigurar: () => void
}) {
  const botonIcono =
    'flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground'
  const vertical = orientacion === 'vertical'

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 pt-3 pb-2">
      <div className="flex items-center gap-3">
        <Avatar nombre={servidor.nombre} tamanio="lg" className="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold tracking-tight">{servidor.nombre}</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {cantidadMiembros !== undefined && `${cantidadMiembros} ${cantidadMiembros === 1 ? 'miembro' : 'miembros'}`}
            {servidor.expira_en && (
              <span className="flex items-center gap-1 text-primary">
                <Hourglass className="size-3" aria-hidden />
                {tiempoRestante(servidor.expira_en)}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {acciones}
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
          <button
            type="button"
            onClick={() => onCambiarOrientacion(vertical ? 'horizontal' : 'vertical')}
            className={`${botonIcono} hidden md:flex`}
            aria-label={vertical ? 'Ver las pestañas en fila, arriba' : 'Ver las pestañas en columna, a la izquierda'}
            title={vertical ? 'Pestañas en fila (arriba)' : 'Pestañas en columna (a la izquierda)'}
          >
            {vertical ? <Rows3 className="size-4" /> : <Columns3 className="size-4" />}
          </button>
          {permisos.puedeInvitar && (
            <button type="button" onClick={onInvitar} className={botonIcono} aria-label="Invitar gente" title="Invitar gente">
              <UserPlus className="size-4" />
            </button>
          )}
          <button type="button" onClick={onConfigurar} className={botonIcono} aria-label="Configuración del servidor" title="Configuración del servidor">
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      {/* En el celular siempre van en fila (no hay lugar para una columna). */}
      {/* key: al cambiar de fila a columna se cierran los menús que hayan quedado abiertos. */}
      <div key={orientacion} className={vertical ? 'md:hidden' : undefined}>
        <SeccionesServidor
          servidorId={servidor.id}
          canales={canales}
          canalId={canalId}
          vista={vista}
          permisos={permisos}
          orientacion="horizontal"
          onCanal={onCanal}
          onVista={onVista}
          onCrearCanal={onCrearCanal}
        />
      </div>
    </div>
  )
}
