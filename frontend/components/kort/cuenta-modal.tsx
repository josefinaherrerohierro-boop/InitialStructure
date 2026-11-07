'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarMiCuenta, borrarMiCuenta, clearToken, mensajeDeError, type Usuario } from '@/lib/api'
import { Confirmar } from './config/confirmar'
import { Modal } from './modal'
import { useToast } from './toast-provider'
import { Boton, Campo, ErrorFormulario, Input } from './ui'

/** "Mi cuenta": cambiar email, usuario o contraseña, o borrar la cuenta. */
export function CuentaModal({
  abierto,
  usuario,
  onCerrar,
  onActualizado,
}: {
  abierto: boolean
  usuario: Usuario
  onCerrar: () => void
  onActualizado: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [email, setEmail] = useState(usuario.email)
  const [username, setUsername] = useState(usuario.username)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')

  function cerrar() {
    setEmail(usuario.email)
    setUsername(usuario.username)
    setPassword('')
    setError(null)
    onCerrar()
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Solo mandamos los campos que cambiaron.
    const cambios: { email?: string; username?: string; password?: string } = {}
    if (email.trim() !== usuario.email) cambios.email = email.trim()
    if (username.trim() !== usuario.username) cambios.username = username.trim()
    if (password) cambios.password = password
    if (Object.keys(cambios).length === 0) {
      cerrar()
      return
    }
    setCargando(true)
    try {
      await actualizarMiCuenta(cambios)
      toast.exito('Guardamos los cambios de tu cuenta.')
      setPassword('')
      onActualizado()
      onCerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <Modal abierto={abierto && !borrando} onCerrar={cerrar} titulo="Mi cuenta">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <Campo id="cuenta-email" etiqueta="Email">
            <Input id="cuenta-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo
            id="cuenta-username"
            etiqueta="Nombre de usuario"
            ayuda="De 3 a 32 caracteres: letras, números, punto y guion bajo."
          >
            <Input id="cuenta-username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Campo>
          <Campo id="cuenta-password" etiqueta="Nueva contraseña" ayuda="Dejala vacía si no la querés cambiar.">
            <Input
              id="cuenta-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Campo>
          <ErrorFormulario mensaje={error} />
          <div className="flex items-center justify-between gap-2">
            <Boton type="button" variante="peligro" onClick={() => setBorrando(true)}>
              Borrar mi cuenta
            </Boton>
            <div className="flex gap-2">
              <Boton type="button" variante="fantasma" onClick={cerrar}>
                Cancelar
              </Boton>
              <Boton type="submit" cargando={cargando}>
                Guardar
              </Boton>
            </div>
          </div>
        </form>
      </Modal>

      <Confirmar
        abierto={abierto && borrando}
        titulo="¿Borrar tu cuenta?"
        descripcion="Se borran tus mensajes y tus membresías. Si sos dueño de algún servidor, primero tenés que transferirlo. Escribí BORRAR para confirmar."
        textoBoton="Borrar mi cuenta"
        deshabilitado={confirmacion !== 'BORRAR'}
        onCerrar={() => {
          setConfirmacion('')
          setBorrando(false)
        }}
        onConfirmar={async () => {
          await borrarMiCuenta()
          clearToken()
          router.replace('/login')
        }}
      >
        <Input aria-label="Escribí BORRAR" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="BORRAR" />
      </Confirmar>
    </>
  )
}
