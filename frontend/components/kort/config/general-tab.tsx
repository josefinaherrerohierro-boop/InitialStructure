'use client'

import { useState } from 'react'
import {
  actualizarServidor,
  borrarServidor,
  mensajeDeError,
  salirDelServidor,
  transferirServidor,
  type Miembro,
  type Servidor,
} from '@/lib/api'
import type { Permisos } from '@/lib/kort'
import { useToast } from '../toast-provider'
import { Boton, Campo, ErrorFormulario, Input } from '../ui'
import { Confirmar, Seccion } from './confirmar'

export function GeneralTab({
  servidor,
  permisos,
  miembros,
  miId,
  onActualizar,
  onSalio,
}: {
  servidor: Servidor
  permisos: Permisos
  miembros: Miembro[]
  miId: number
  onActualizar: () => void
  onSalio: () => void
}) {
  const toast = useToast()
  const [nombre, setNombre] = useState(servidor.nombre)
  const [guardando, setGuardando] = useState(false)
  const [errorNombre, setErrorNombre] = useState<string | null>(null)
  const [nuevoDuenio, setNuevoDuenio] = useState('')
  const [confirmacionNombre, setConfirmacionNombre] = useState('')
  const [dialogo, setDialogo] = useState<'transferir' | 'borrar' | 'salir' | null>(null)

  const candidatos = miembros.filter((m) => m.usuario_id !== miId)
  const elegido = candidatos.find((m) => String(m.usuario_id) === nuevoDuenio)

  async function guardarNombre(e: React.FormEvent) {
    e.preventDefault()
    setErrorNombre(null)
    setGuardando(true)
    try {
      await actualizarServidor(servidor.id, { nombre: nombre.trim() })
      toast.exito('Guardamos el nuevo nombre.')
      onActualizar()
    } catch (err) {
      setErrorNombre(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {permisos.esDuenio && (
        <Seccion titulo="Nombre del servidor">
          <form onSubmit={guardarNombre} className="flex flex-col gap-3">
            <Campo id="config-nombre" etiqueta="Nombre">
              <Input id="config-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Campo>
            <ErrorFormulario mensaje={errorNombre} />
            <div>
              <Boton type="submit" cargando={guardando} disabled={!nombre.trim() || nombre.trim() === servidor.nombre}>
                Guardar cambios
              </Boton>
            </div>
          </form>
        </Seccion>
      )}

      {/* HU10: salir del servidor */}
      <Seccion
        titulo="Salir del servidor"
        descripcion={
          permisos.esDuenio
            ? 'Sos el dueño: para irte, primero transferí el servidor a otro miembro.'
            : 'Vas a dejar de ver sus canales y perder tus roles acá. Para volver, vas a necesitar otra invitación.'
        }
      >
        <div>
          <Boton variante="secundario" disabled={permisos.esDuenio} onClick={() => setDialogo('salir')}>
            Salir de “{servidor.nombre}”
          </Boton>
        </div>
      </Seccion>

      {permisos.esDuenio && (
        <Seccion titulo="Zona de peligro" peligro>
          {/* HU10: transferir la propiedad a un miembro actual */}
          <div className="flex flex-col gap-3">
            <Campo
              id="nuevo-duenio"
              etiqueta="Transferir el servidor"
              ayuda="El nuevo dueño tiene que ser un miembro actual. Vos vas a quedar como miembro común."
            >
              <select
                id="nuevo-duenio"
                value={nuevoDuenio}
                onChange={(e) => setNuevoDuenio(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/70"
              >
                <option value="">Elegí un miembro…</option>
                {candidatos.map((m) => (
                  <option key={m.usuario_id} value={m.usuario_id}>
                    {m.username}
                  </option>
                ))}
              </select>
            </Campo>
            <div>
              <Boton variante="peligro" disabled={!elegido} onClick={() => setDialogo('transferir')}>
                Transferir
              </Boton>
            </div>
          </div>

          <div className="h-px bg-destructive/20" aria-hidden />

          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Borrar el servidor elimina para siempre sus canales, mensajes, roles e invitaciones.
            </p>
            <div>
              <Boton variante="peligro" onClick={() => setDialogo('borrar')}>
                Borrar servidor
              </Boton>
            </div>
          </div>
        </Seccion>
      )}

      <Confirmar
        abierto={dialogo === 'salir'}
        titulo="¿Salir del servidor?"
        descripcion={`Vas a dejar “${servidor.nombre}”.`}
        textoBoton="Salir"
        onCerrar={() => setDialogo(null)}
        onConfirmar={async () => {
          await salirDelServidor(servidor.id)
          toast.exito(`Saliste de “${servidor.nombre}”.`)
          onSalio()
        }}
      />

      <Confirmar
        abierto={dialogo === 'transferir'}
        titulo="¿Transferir el servidor?"
        descripcion={elegido ? `${elegido.username} va a ser el nuevo dueño. Esta acción no la podés deshacer vos.` : ''}
        textoBoton="Sí, transferir"
        onCerrar={() => setDialogo(null)}
        onConfirmar={async () => {
          if (!elegido) return
          await transferirServidor(servidor.id, elegido.usuario_id)
          toast.exito(`Ahora ${elegido.username} es el dueño.`)
          setNuevoDuenio('')
          onActualizar()
        }}
      />

      <Confirmar
        abierto={dialogo === 'borrar'}
        titulo="¿Borrar el servidor?"
        descripcion="Para confirmar, escribí el nombre exacto del servidor."
        textoBoton="Borrar para siempre"
        deshabilitado={confirmacionNombre !== servidor.nombre}
        onCerrar={() => {
          setConfirmacionNombre('')
          setDialogo(null)
        }}
        onConfirmar={async () => {
          await borrarServidor(servidor.id)
          toast.exito('El servidor se borró.')
          onSalio()
        }}
      >
        <Input
          aria-label="Nombre del servidor"
          value={confirmacionNombre}
          onChange={(e) => setConfirmacionNombre(e.target.value)}
          placeholder={servidor.nombre}
        />
      </Confirmar>
    </div>
  )
}
