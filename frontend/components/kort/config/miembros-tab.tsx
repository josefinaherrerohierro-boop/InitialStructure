'use client'

import { useState } from 'react'
import { Ban, UserMinus, X } from 'lucide-react'
import {
  asignarRol,
  banearMiembro,
  expulsarMiembro,
  mensajeDeError,
  quitarRol,
  type Miembro,
  type Rol,
} from '@/lib/api'
import { parseFecha, type Permisos } from '@/lib/kort'
import { useToast } from '../toast-provider'
import { Avatar } from '../ui'
import { Confirmar, Seccion } from './confirmar'

const EVERYONE = '@everyone'
const formatoFecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** HU4 (asignar roles) y HU9 (expulsar y banear). */
export function MiembrosTab({
  servidorId,
  miembros,
  roles,
  permisos,
  miId,
  onActualizar,
}: {
  servidorId: number
  miembros: Miembro[]
  roles: Rol[]
  permisos: Permisos
  miId: number
  onActualizar: () => void
}) {
  const toast = useToast()
  const [accion, setAccion] = useState<{ tipo: 'expulsar' | 'banear'; miembro: Miembro } | null>(null)
  const rolesAsignables = roles.filter((r) => r.nombre !== EVERYONE)

  async function agregarRol(m: Miembro, rolId: number) {
    try {
      await asignarRol(servidorId, m.usuario_id, rolId)
      onActualizar()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  async function sacarRol(m: Miembro, rolId: number) {
    try {
      await quitarRol(servidorId, m.usuario_id, rolId)
      onActualizar()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <Seccion
      titulo={`Miembros (${miembros.length})`}
      descripcion={
        permisos.esDuenio
          ? 'Asigná roles y moderá a los miembros. Nadie puede expulsar ni banear al dueño.'
          : 'Como moderador podés expulsar o banear miembros. Nadie puede expulsar ni banear al dueño.'
      }
    >
      <ul className="flex flex-col divide-y divide-border">
        {miembros.map((m) => {
          const susRoles = m.roles.filter((r) => r.nombre !== EVERYONE)
          const faltantes = rolesAsignables.filter((r) => !m.roles.some((x) => x.id === r.id))
          const moderable = permisos.esModerador && !m.es_duenio && m.usuario_id !== miId
          return (
            <li key={m.usuario_id} className="flex flex-col gap-2.5 py-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar nombre={m.username} />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="truncate text-sm font-medium">
                    {m.username}
                    {m.usuario_id === miId && <span className="ml-1 font-normal text-muted-foreground">(vos)</span>}
                    {m.es_duenio && (
                      <span className="ml-2 rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                        Dueño
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Se unió el {formatoFecha.format(parseFecha(m.fecha_union))}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {susRoles.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-md bg-elevated px-1.5 py-0.5 text-[11px] font-medium"
                      >
                        {r.nombre}
                        {permisos.esDuenio && (
                          <button
                            type="button"
                            onClick={() => sacarRol(m, r.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Quitar el rol ${r.nombre} a ${m.username}`}
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {permisos.esDuenio && faltantes.length > 0 && (
                      <select
                        aria-label={`Agregar un rol a ${m.username}`}
                        value=""
                        onChange={(e) => e.target.value && agregarRol(m, Number(e.target.value))}
                        className="h-6 rounded-md border border-dashed border-border bg-transparent px-1.5 text-[11px] text-muted-foreground outline-none hover:border-primary/50"
                      >
                        <option value="">+ Agregar rol</option>
                        {faltantes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {moderable && (
                <div className="flex gap-1.5 pl-12 sm:pl-0">
                  <button
                    type="button"
                    onClick={() => setAccion({ tipo: 'expulsar', miembro: m })}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground"
                  >
                    <UserMinus className="size-3.5" aria-hidden />
                    Expulsar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccion({ tipo: 'banear', miembro: m })}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-destructive hover:bg-destructive/15"
                  >
                    <Ban className="size-3.5" aria-hidden />
                    Banear
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <Confirmar
        abierto={accion !== null}
        titulo={
          accion?.tipo === 'banear' ? `¿Banear a ${accion.miembro.username}?` : `¿Expulsar a ${accion?.miembro.username}?`
        }
        descripcion={
          accion?.tipo === 'banear'
            ? 'No va a poder volver a entrar, ni siquiera con una invitación nueva.'
            : 'Va a salir del servidor, pero puede volver con otra invitación.'
        }
        textoBoton={accion?.tipo === 'banear' ? 'Banear' : 'Expulsar'}
        onCerrar={() => setAccion(null)}
        onConfirmar={async () => {
          if (!accion) return
          if (accion.tipo === 'banear') await banearMiembro(servidorId, accion.miembro.usuario_id)
          else await expulsarMiembro(servidorId, accion.miembro.usuario_id)
          toast.exito(
            accion.tipo === 'banear'
              ? `Baneaste a ${accion.miembro.username}.`
              : `Expulsaste a ${accion.miembro.username}.`,
          )
          onActualizar()
        }}
      />
    </Seccion>
  )
}
