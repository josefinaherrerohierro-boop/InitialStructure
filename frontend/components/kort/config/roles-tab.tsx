'use client'

import { useState } from 'react'
import { Pencil, Shield, Trash2 } from 'lucide-react'
import { actualizarRol, borrarRol, crearRol, mensajeDeError, type DatosRol, type Rol } from '@/lib/api'
import { useToast } from '../toast-provider'
import { Boton, Campo, ErrorFormulario, Input } from '../ui'
import { Confirmar, Interruptor, Seccion } from './confirmar'

const EVERYONE = '@everyone'

/** HU4: crear y administrar roles (solo el dueño). */
export function RolesTab({
  servidorId,
  roles,
  onActualizar,
}: {
  servidorId: number
  roles: Rol[]
  onActualizar: () => void
}) {
  const toast = useToast()
  const [nombre, setNombre] = useState('')
  const [permisos, setPermisos] = useState({ puede_escribir: true, puede_moderar: false, puede_invitar: false })
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const rol = await crearRol(servidorId, { nombre: nombre.trim(), ...permisos })
      toast.exito(`Creaste el rol “${rol.nombre}”.`)
      setNombre('')
      setPermisos({ puede_escribir: true, puede_moderar: false, puede_invitar: false })
      onActualizar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Seccion titulo="Crear rol" descripcion="El nombre no se puede repetir dentro del servidor.">
        <form onSubmit={crear} className="flex flex-col gap-4">
          <Campo id="rol-nombre" etiqueta="Nombre del rol">
            <Input id="rol-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Ayudante" />
          </Campo>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Interruptor
              etiqueta="Puede escribir"
              activo={permisos.puede_escribir}
              onCambiar={(v) => setPermisos((p) => ({ ...p, puede_escribir: v }))}
            />
            <Interruptor
              etiqueta="Puede moderar"
              activo={permisos.puede_moderar}
              onCambiar={(v) => setPermisos((p) => ({ ...p, puede_moderar: v }))}
            />
            <Interruptor
              etiqueta="Puede invitar"
              activo={permisos.puede_invitar}
              onCambiar={(v) => setPermisos((p) => ({ ...p, puede_invitar: v }))}
            />
          </div>
          <ErrorFormulario mensaje={error} />
          <div>
            <Boton type="submit" cargando={cargando} disabled={!nombre.trim()}>
              Crear rol
            </Boton>
          </div>
        </form>
      </Seccion>

      <Seccion
        titulo="Roles del servidor"
        descripcion="@everyone lo tienen todos los miembros: se le pueden cambiar los permisos, pero no borrar ni renombrar."
      >
        <ul className="flex flex-col divide-y divide-border">
          {roles.map((r) => (
            <FilaRol key={r.id} rol={r} onActualizar={onActualizar} />
          ))}
        </ul>
      </Seccion>
    </div>
  )
}

function FilaRol({ rol, onActualizar }: { rol: Rol; onActualizar: () => void }) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(rol.nombre)
  const [borrando, setBorrando] = useState(false)
  const esEveryone = rol.nombre === EVERYONE

  async function guardar(cambios: DatosRol) {
    try {
      await actualizarRol(rol.id, cambios)
      onActualizar()
      setEditando(false)
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-center gap-2">
        <Shield className="size-4 shrink-0 text-primary" aria-hidden />
        {editando ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              guardar({ nombre: nombre.trim() })
            }}
          >
            <Input autoFocus aria-label="Nombre del rol" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-9" />
            <Boton type="submit" className="h-9">
              Guardar
            </Boton>
            <Boton type="button" variante="fantasma" className="h-9" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
          </form>
        ) : (
          <span className="flex-1 truncate text-sm font-semibold">{rol.nombre}</span>
        )}
        {!esEveryone && !editando && (
          <>
            <button
              type="button"
              onClick={() => {
                setNombre(rol.nombre)
                setEditando(true)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground"
              aria-label={`Renombrar ${rol.nombre}`}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setBorrando(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              aria-label={`Borrar ${rol.nombre}`}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 pl-6">
        <Interruptor etiqueta="Puede escribir" activo={rol.puede_escribir} onCambiar={(v) => guardar({ puede_escribir: v })} />
        <Interruptor etiqueta="Puede moderar" activo={rol.puede_moderar} onCambiar={(v) => guardar({ puede_moderar: v })} />
        <Interruptor etiqueta="Puede invitar" activo={rol.puede_invitar} onCambiar={(v) => guardar({ puede_invitar: v })} />
      </div>

      <Confirmar
        abierto={borrando}
        titulo={`¿Borrar el rol “${rol.nombre}”?`}
        descripcion="Se le quita a todos los miembros que lo tengan."
        textoBoton="Borrar rol"
        onCerrar={() => setBorrando(false)}
        onConfirmar={async () => {
          await borrarRol(rol.id)
          toast.exito('Rol borrado.')
          onActualizar()
        }}
      />
    </li>
  )
}
