'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { cambiarClaveBorrado, mensajeDeError, type Servidor } from '@/lib/api'
import { useCambiosPendientes } from '../cambios-pendientes'
import { useToast } from '../toast-provider'
import { Boton, Campo, ErrorFormulario, Input } from '../ui'
import { Seccion } from './confirmar'

/** Elegir o cambiar la contraseña para borrar el servidor (solo el dueño). */
export function ClaveBorrado({ servidor, onActualizar }: { servidor: Servidor; onActualizar: () => void }) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [cuenta, setCuenta] = useState('')
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  useCambiosPendientes(cuenta !== '' || nueva !== '')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await cambiarClaveBorrado(servidor.id, cuenta, nueva)
      toast.exito('Guardamos la contraseña para borrar el servidor.')
      setCuenta('')
      setNueva('')
      setAbierto(false)
      onActualizar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Seccion
      titulo="Contraseña para borrar el servidor"
      descripcion={
        servidor.tiene_clave_borrado
          ? 'Se pide para borrar el servidor. Si te la olvidaste, cambiala confirmando con la contraseña de tu cuenta.'
          : 'Este servidor todavía no tiene una: para borrarlo se pide la contraseña de tu cuenta. Podés elegir una propia.'
      }
    >
      {abierto ? (
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <Campo id="clave-cuenta" etiqueta="Contraseña de tu cuenta">
            <Input id="clave-cuenta" type="password" autoComplete="current-password" value={cuenta} onChange={(e) => setCuenta(e.target.value)} />
          </Campo>
          <Campo id="clave-nueva" etiqueta="Nueva contraseña para borrar el servidor" ayuda="Al menos 4 caracteres.">
            <Input id="clave-nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </Campo>
          <ErrorFormulario mensaje={error} />
          <div className="flex gap-2">
            <Boton type="submit" cargando={cargando} disabled={!cuenta || nueva.length < 4}>
              Guardar
            </Boton>
            <Boton type="button" variante="fantasma" onClick={() => { setAbierto(false); setCuenta(''); setNueva(''); setError(null) }}>
              Cancelar
            </Boton>
          </div>
        </form>
      ) : (
        <div>
          <Boton variante="secundario" onClick={() => setAbierto(true)}>
            <KeyRound className="size-4" aria-hidden />
            {servidor.tiene_clave_borrado ? 'Cambiar contraseña' : 'Elegir una contraseña'}
          </Boton>
        </div>
      )}
    </Seccion>
  )
}
