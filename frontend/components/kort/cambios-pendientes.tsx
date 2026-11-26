'use client'

/**
 * Aviso de "cambios sin guardar" en las pantallas de configuración.
 *
 * Cada formulario avisa si tiene algo modificado con useCambiosPendientes(sucio).
 * La pantalla de configuración, antes de cerrarse o de cambiar de pestaña,
 * pregunta con useCerrarConAviso() si hay algo sin guardar.
 */

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { Modal } from './modal'
import { Boton } from './ui'

const Contexto = createContext<Set<string> | null>(null)

/** Lo usan los formularios: `useCambiosPendientes(nombre !== original)`. */
export function useCambiosPendientes(sucio: boolean) {
  const pendientes = useContext(Contexto)
  const id = useId()
  useEffect(() => {
    if (!pendientes) return
    if (sucio) pendientes.add(id)
    else pendientes.delete(id)
    return () => {
      pendientes.delete(id)
    }
  }, [pendientes, id, sucio])
}

/**
 * Para la pantalla de configuración. Devuelve:
 * - Proveedor: envuelve el contenido (los formularios de adentro se registran).
 * - intentar(accion): corre la acción, o primero pregunta si hay cambios sin guardar.
 * - aviso: el diálogo de "¿Salir sin guardar?" (hay que dibujarlo).
 */
export function useCerrarConAviso() {
  const pendientes = useRef(new Set<string>()).current
  const [accionPendiente, setAccionPendiente] = useState<(() => void) | null>(null)

  const intentar = useCallback(
    (accion: () => void) => {
      if (pendientes.size > 0) setAccionPendiente(() => accion)
      else accion()
    },
    [pendientes],
  )

  const Proveedor = useCallback(
    ({ children }: { children: React.ReactNode }) => <Contexto.Provider value={pendientes}>{children}</Contexto.Provider>,
    [pendientes],
  )

  const aviso = (
    <Modal
      abierto={accionPendiente !== null}
      onCerrar={() => setAccionPendiente(null)}
      titulo="Tenés cambios sin guardar"
      descripcion="Si salís ahora, lo que cambiaste no se va a guardar."
    >
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={() => setAccionPendiente(null)}>
          Seguir editando
        </Boton>
        <Boton
          variante="peligro"
          onClick={() => {
            const accion = accionPendiente
            pendientes.clear()
            setAccionPendiente(null)
            accion?.()
          }}
        >
          Salir sin guardar
        </Boton>
      </div>
    </Modal>
  )

  return { Proveedor, intentar, aviso }
}
