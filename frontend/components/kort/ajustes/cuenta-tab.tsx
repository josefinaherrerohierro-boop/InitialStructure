'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarMiCuenta, borrarMiCuenta, clearToken, mensajeDeError, type Usuario } from '@/lib/api'
import { useCambiosPendientes } from '../cambios-pendientes'
import { Confirmar, Seccion } from '../config/confirmar'
import { useToast } from '../toast-provider'
import { Boton, Campo, ErrorFormulario, Input } from '../ui'

/** Cambiar email, usuario o contraseña, o borrar la cuenta. */
export function CuentaTab({ usuario, onActualizado }: { usuario: Usuario; onActualizado: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [email, setEmail] = useState(usuario.email)
  const [username, setUsername] = useState(usuario.username)
  const [password, setPassword] = useState('')
  useCambiosPendientes(email.trim() !== usuario.email || username.trim() !== usuario.username || password !== '')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Solo mandamos los campos que cambiaron.
    const cambios: { email?: string; username?: string; password?: string } = {}
    if (email.trim() !== usuario.email) cambios.email = email.trim()
    if (username.trim() !== usuario.username) cambios.username = username.trim()
    if (password) cambios.password = password
    if (Object.keys(cambios).length === 0) return
    setCargando(true)
    try {
      await actualizarMiCuenta(cambios)
      toast.exito('Guardamos los cambios de tu cuenta.')
      setPassword('')
      onActualizado()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Seccion titulo="Datos de la cuenta">
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
          <div className="flex justify-end">
            <Boton type="submit" cargando={cargando}>
              Guardar
            </Boton>
          </div>
        </form>
      </Seccion>

      <Seccion
        titulo="Borrar mi cuenta"
        descripcion="Se borran tus mensajes y tus membresías. Si sos dueño de algún servidor, primero tenés que transferirlo."
        peligro
      >
        <div>
          <Boton type="button" variante="peligro" onClick={() => setBorrando(true)}>
            Borrar mi cuenta
          </Boton>
        </div>
      </Seccion>

      <Confirmar
        abierto={borrando}
        titulo="¿Borrar tu cuenta?"
        descripcion="Esto no se puede deshacer. Escribí BORRAR para confirmar."
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
    </div>
  )
}
