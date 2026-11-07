'use client'

import { useState } from 'react'
import { mensajeDeError } from '@/lib/api'
import { Modal } from '../modal'
import { Boton, ErrorFormulario } from '../ui'

/**
 * Ventana de confirmación reutilizable para acciones delicadas
 * (borrar, expulsar, banear, transferir...). Muestra el error de la API
 * si la acción falla.
 */
export function Confirmar({
  abierto,
  titulo,
  descripcion,
  textoBoton,
  peligro = true,
  onConfirmar,
  onCerrar,
  children,
  deshabilitado,
}: {
  abierto: boolean
  titulo: string
  descripcion?: string
  textoBoton: string
  peligro?: boolean
  onConfirmar: () => Promise<void>
  onCerrar: () => void
  children?: React.ReactNode
  deshabilitado?: boolean
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cerrar() {
    setError(null)
    onCerrar()
  }

  async function confirmar() {
    setError(null)
    setCargando(true)
    try {
      await onConfirmar()
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo={titulo} descripcion={descripcion}>
      <div className="flex flex-col gap-4">
        {children}
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton
            type="button"
            variante={peligro ? 'peligro' : 'primario'}
            cargando={cargando}
            disabled={deshabilitado}
            onClick={confirmar}
          >
            {textoBoton}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/** Título + descripción de cada sección de la configuración. */
export function Seccion({
  titulo,
  descripcion,
  peligro,
  children,
}: {
  titulo: string
  descripcion?: string
  peligro?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={
        peligro
          ? 'flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5'
          : 'flex flex-col gap-4 rounded-xl border border-border bg-surface p-5'
      }
    >
      <div className="flex flex-col gap-1">
        <h3 className={peligro ? 'font-semibold text-destructive' : 'font-semibold'}>{titulo}</h3>
        {descripcion && <p className="text-sm leading-relaxed text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </section>
  )
}

/** Interruptor de encendido/apagado (para los permisos de los roles). */
export function Interruptor({
  activo,
  onCambiar,
  etiqueta,
  deshabilitado,
}: {
  activo: boolean
  onCambiar: (v: boolean) => void
  etiqueta: string
  deshabilitado?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        disabled={deshabilitado}
        onClick={() => onCambiar(!activo)}
        className={
          'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ' +
          (activo ? 'bg-primary' : 'bg-border')
        }
      >
        <span
          className={
            'absolute top-0.5 size-4 rounded-full bg-foreground transition-transform ' +
            (activo ? 'translate-x-4' : 'translate-x-0.5')
          }
        />
      </button>
      <span className="text-muted-foreground">{etiqueta}</span>
    </label>
  )
}
