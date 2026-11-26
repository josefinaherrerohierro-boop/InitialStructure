'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { AlarmClock, CircleCheck, CircleDashed, CircleDot, ListPlus, Trash2, UserRound } from 'lucide-react'
import {
  borrarTarea,
  crearTarea,
  editarTarea,
  getTareas,
  mensajeDeError,
  type EstadoTarea,
  type Miembro,
  type Tarea,
} from '@/lib/api'
import { horaMensaje, type Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { Interruptor } from './config/confirmar'
import { aInputFecha, aISO } from './encuesta-modal'
import { Modal } from './modal'
import { useToast } from './toast-provider'
import { Avatar, Boton, Campo, ErrorFormulario, Input } from './ui'

const COLUMNAS: { estado: EstadoTarea; titulo: string; Icono: typeof CircleDot; color: string }[] = [
  { estado: 'pendiente', titulo: 'Pendientes', Icono: CircleDashed, color: 'text-muted-foreground' },
  { estado: 'en_progreso', titulo: 'En progreso', Icono: CircleDot, color: 'text-warning' },
  { estado: 'hecha', titulo: 'Hechas', Icono: CircleCheck, color: 'text-success' },
]

const ETIQUETA_ESTADO: Record<EstadoTarea, string> = { pendiente: 'Pendiente', en_progreso: 'En progreso', hecha: 'Hecha' }

const selectClase = 'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm'

function NuevaTareaModal({
  abierto,
  servidorId,
  miembros,
  miId,
  permisos,
  onCerrar,
  onCreada,
}: {
  abierto: boolean
  servidorId: number
  miembros: Miembro[]
  miId: number
  permisos: Permisos
  onCerrar: () => void
  onCreada: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [asignado, setAsignado] = useState<string>('')
  const [limite, setLimite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  function cerrar() {
    setTitulo('')
    setDescripcion('')
    setAsignado('')
    setLimite('')
    setError(null)
    onCerrar()
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await crearTarea(servidorId, {
        titulo: titulo.trim(),
        descripcion,
        asignado_id: asignado ? Number(asignado) : null,
        fecha_limite: limite ? aISO(limite) : null,
      })
      onCreada()
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  // Los moderadores pueden asignarle a cualquiera; el resto, solo a sí mismo.
  const asignables = permisos.esModerador ? miembros : miembros.filter((m) => m.usuario_id === miId)

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Nueva tarea">
      <form onSubmit={crear} className="flex flex-col gap-4">
        <Campo id="tarea-titulo" etiqueta="Título">
          <Input id="tarea-titulo" autoFocus maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Armar la presentación" />
        </Campo>
        <Campo id="tarea-desc" etiqueta="Descripción (opcional)">
          <textarea
            id="tarea-desc"
            rows={3}
            maxLength={1000}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="tarea-asignado" etiqueta="Asignada a">
            <select id="tarea-asignado" value={asignado} onChange={(e) => setAsignado(e.target.value)} className={selectClase}>
              <option value="">Nadie todavía</option>
              {asignables.map((m) => (
                <option key={m.usuario_id} value={m.usuario_id}>
                  {m.apodo || m.username}
                  {m.usuario_id === miId ? ' (vos)' : ''}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="tarea-limite" etiqueta="Fecha límite (opcional)">
            <Input id="tarea-limite" type="datetime-local" value={limite} min={aInputFecha(new Date())} onChange={(e) => setLimite(e.target.value)} />
          </Campo>
        </div>
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando} disabled={!titulo.trim()}>
            Crear tarea
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

function TarjetaTarea({
  t,
  miId,
  permisos,
  onCambio,
}: {
  t: Tarea
  miId: number
  permisos: Permisos
  onCambio: () => void
}) {
  const toast = useToast()
  const esCreador = t.creador.id === miId
  const puedeEstado = permisos.esModerador || esCreador || t.asignado?.id === miId
  const puedeBorrar = permisos.esModerador || esCreador

  async function hacer(accion: () => Promise<unknown>) {
    try {
      await accion()
      onCambio()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <article className={cn('flex flex-col gap-2 rounded-xl border bg-surface p-3', t.vencida ? 'border-destructive/50' : 'border-border')}>
      <div className="flex items-start gap-2">
        <h4 className={cn('min-w-0 flex-1 text-sm font-medium', t.estado === 'hecha' && 'text-muted-foreground line-through')}>
          {t.titulo}
        </h4>
        {puedeBorrar && (
          <button
            type="button"
            onClick={() => hacer(() => borrarTarea(t.id))}
            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Borrar tarea"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {t.descripcion && <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{t.descripcion}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {t.asignado ? (
          <span className="flex items-center gap-1.5">
            <Avatar nombre={t.asignado.username} url={t.asignado.avatar_url} tamanio="sm" className="size-5 text-[9px]" />
            {t.asignado.username}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => hacer(() => editarTarea(t.id, { asignado_id: miId }))}
            className="flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            <UserRound className="size-3" aria-hidden />
            Tomarla
          </button>
        )}
        {t.fecha_limite && (
          <span className={cn('flex items-center gap-1', t.vencida ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            <AlarmClock className="size-3" aria-hidden />
            {t.vencida ? 'Venció ' : ''}
            {horaMensaje(t.fecha_limite)}
          </span>
        )}
      </div>
      {puedeEstado && (
        <select
          aria-label="Estado de la tarea"
          value={t.estado}
          onChange={(e) => hacer(() => editarTarea(t.id, { estado: e.target.value as EstadoTarea }))}
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
        >
          {COLUMNAS.map((c) => (
            <option key={c.estado} value={c.estado}>
              {ETIQUETA_ESTADO[c.estado]}
            </option>
          ))}
        </select>
      )}
    </article>
  )
}

export function TareasView({
  servidorId,
  miId,
  miembros,
  permisos,
}: {
  servidorId: number
  miId: number
  miembros: Miembro[]
  permisos: Permisos
}) {
  const [soloMias, setSoloMias] = useState(false)
  const [creando, setCreando] = useState(false)
  const { data: tareas, mutate } = useSWR(['tareas', servidorId, soloMias], () => getTareas(servidorId, soloMias), {
    refreshInterval: 15000,
  })

  return (
    <div className="scrollbar-thin @container flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Interruptor activo={soloMias} onCambiar={setSoloMias} etiqueta="Solo las mías" />
          {permisos.puedeEscribir && (
            <Boton className="ml-auto h-9 px-3" onClick={() => setCreando(true)}>
              <ListPlus className="size-4" aria-hidden />
              Nueva tarea
            </Boton>
          )}
        </div>
        <div className="grid gap-4 @3xl:grid-cols-3">
          {COLUMNAS.map(({ estado, titulo, Icono, color }) => {
            const lista = (tareas ?? []).filter((t) => t.estado === estado)
            return (
              <section key={estado} aria-label={titulo} className="flex flex-col gap-2 rounded-2xl bg-surface/50 p-3">
                <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
                  <Icono className={cn('size-4', color)} aria-hidden />
                  {titulo}
                  <span className="text-muted-foreground">{lista.length}</span>
                </h3>
                {lista.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nada por acá.</p>
                ) : (
                  lista.map((t) => <TarjetaTarea key={t.id} t={t} miId={miId} permisos={permisos} onCambio={() => mutate()} />)
                )}
              </section>
            )
          })}
        </div>
      </div>
      <NuevaTareaModal
        abierto={creando}
        servidorId={servidorId}
        miembros={miembros}
        miId={miId}
        permisos={permisos}
        onCerrar={() => setCreando(false)}
        onCreada={() => mutate()}
      />
    </div>
  )
}
