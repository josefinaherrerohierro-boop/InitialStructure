'use client'

/**
 * Tareas del servidor, en un tablero de tres columnas (Pendientes, En progreso
 * y Hechas). El estado se cambia ARRASTRANDO la tarjeta a otra columna.
 *
 * - Mover una tarea: la persona asignada, quien la creó o un moderador/dueño.
 * - Editar (título, descripción, imagen, fecha, responsable) o borrar: quien
 *   la creó o un moderador/dueño.
 * - Puntos: solo un moderador o el dueño los fija; los gana quien la complete.
 * Todas estas reglas las vuelve a controlar el backend.
 */

import { useRef, useState } from 'react'
import useSWR from 'swr'
import {
  AlarmClock,
  CircleCheck,
  CircleDashed,
  CircleDot,
  GripVertical,
  ImagePlus,
  ListPlus,
  Pencil,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  borrarTarea,
  crearTarea,
  editarTarea,
  getTareas,
  mensajeDeError,
  subirArchivo,
  urlArchivo,
  type EstadoTarea,
  type Miembro,
  type Tarea,
} from '@/lib/api'
import { horaMensaje, parseFecha, type Permisos } from '@/lib/kort'
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

const selectClase = 'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm'

// ---------- Permisos sobre una tarea (los mismos que controla el backend) ----------
function puedeMover(t: Tarea, miId: number, permisos: Permisos) {
  return permisos.esModerador || t.creador.id === miId || t.asignado?.id === miId
}
function puedeEditar(t: Tarea, miId: number, permisos: Permisos) {
  return permisos.esModerador || t.creador.id === miId
}

/** Etiqueta con los puntos que da la tarea. */
function Puntos({ t, className }: { t: Tarea; className?: string }) {
  if (!t.puntos) return null
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning', className)}
      title={t.puntos_otorgados_a ? `Se le dieron a ${t.puntos_otorgados_a.username}` : 'Los gana quien la complete'}
    >
      <Star className="size-3" aria-hidden />
      {t.puntos} {t.puntos === 1 ? 'punto' : 'puntos'}
    </span>
  )
}

// ======================================================================
// Formulario para crear o editar una tarea
// ======================================================================
function TareaFormModal({
  abierto,
  servidorId,
  tarea,
  miembros,
  miId,
  permisos,
  onCerrar,
  onGuardada,
}: {
  abierto: boolean
  servidorId: number
  /** Si viene una tarea, el formulario la edita; si no, crea una nueva. */
  tarea?: Tarea | null
  miembros: Miembro[]
  miId: number
  permisos: Permisos
  onCerrar: () => void
  onGuardada: (t: Tarea) => void
}) {
  const toast = useToast()
  const editando = !!tarea
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '')
  const [asignado, setAsignado] = useState<string>(tarea?.asignado ? String(tarea.asignado.id) : '')
  const [limite, setLimite] = useState(tarea?.fecha_limite ? aInputFecha(parseFecha(tarea.fecha_limite)) : '')
  const [imagen, setImagen] = useState<string | null>(tarea?.imagen_url ?? null)
  const [puntos, setPuntos] = useState(String(tarea?.puntos ?? 0))
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const inputImagen = useRef<HTMLInputElement>(null)

  // Los puntos no se pueden cambiar con la tarea ya hecha (habría que reabrirla).
  const puntosBloqueados = editando && tarea?.estado === 'hecha'

  async function subirImagen(archivo: File) {
    setSubiendo(true)
    try {
      const subido = await subirArchivo(archivo)
      if (subido.tipo !== 'imagen') throw new Error('Elegí una imagen (PNG, JPG, GIF o WEBP).')
      setImagen(subido.url)
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setSubiendo(false)
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cantidad = Number(puntos || 0)
    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > 1000) {
      setError('Los puntos tienen que ser un número entero entre 0 y 1000.')
      return
    }
    setCargando(true)
    try {
      const datos = {
        titulo: titulo.trim(),
        descripcion,
        asignado_id: asignado ? Number(asignado) : null,
        fecha_limite: limite ? aISO(limite) : null,
        imagen_url: imagen,
        // Solo los moderadores mandan los puntos (para el resto, el backend los rechaza).
        ...(permisos.esModerador && !puntosBloqueados ? { puntos: cantidad } : {}),
      }
      const guardada = editando && tarea ? await editarTarea(tarea.id, datos) : await crearTarea(servidorId, datos)
      onGuardada(guardada)
      onCerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  // Los moderadores pueden asignarle a cualquiera; el resto, solo a sí mismo
  // (y se mantiene a quien ya estaba asignado, para no perderlo al editar).
  const asignables = permisos.esModerador
    ? miembros
    : miembros.filter((m) => m.usuario_id === miId || m.usuario_id === tarea?.asignado?.id)

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? 'Editar tarea' : 'Nueva tarea'}>
      <form onSubmit={guardar} className="scrollbar-thin -mx-1 flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-1">
        <Campo id="tarea-titulo" etiqueta="Título">
          <Input
            id="tarea-titulo"
            autoFocus
            maxLength={120}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej.: Armar la presentación"
          />
        </Campo>
        <Campo id="tarea-desc" etiqueta="Descripción (opcional)">
          <textarea
            id="tarea-desc"
            rows={4}
            maxLength={1000}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué hay que hacer, links, detalles…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          />
        </Campo>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Imagen (opcional)</span>
          {imagen ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlArchivo(imagen)} alt="" className="max-h-48 rounded-xl border border-border" />
              <button
                type="button"
                onClick={() => setImagen(null)}
                className="absolute top-2 right-2 rounded-full bg-black/70 p-1 text-white"
                aria-label="Quitar imagen"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputImagen.current?.click()}
              disabled={subiendo}
              className="flex h-20 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-primary disabled:opacity-60"
            >
              <ImagePlus className="size-4" aria-hidden />
              {subiendo ? 'Subiendo…' : 'Agregar una imagen'}
            </button>
          )}
          <input
            ref={inputImagen}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (archivo) subirImagen(archivo)
            }}
          />
        </div>

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
            <Input
              id="tarea-limite"
              type="datetime-local"
              value={limite}
              min={editando ? undefined : aInputFecha(new Date())}
              onChange={(e) => setLimite(e.target.value)}
            />
          </Campo>
        </div>

        {permisos.esModerador && (
          <Campo
            id="tarea-puntos"
            etiqueta="Puntos para quien la complete"
            ayuda={
              puntosBloqueados
                ? 'La tarea ya está hecha: movela a otra columna para cambiar los puntos.'
                : 'Se suman al scoreboard cuando la tarea pasa a Hechas. 0 = sin puntos.'
            }
          >
            <Input
              id="tarea-puntos"
              type="number"
              min={0}
              max={1000}
              step={1}
              value={puntos}
              disabled={puntosBloqueados}
              onChange={(e) => setPuntos(e.target.value)}
              className="w-32"
            />
          </Campo>
        )}

        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando} disabled={!titulo.trim() || subiendo}>
            {editando ? 'Guardar cambios' : 'Crear tarea'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

// ======================================================================
// Detalle de una tarea (se abre al tocar la tarjeta)
// ======================================================================
function TareaDetalleModal({
  tarea,
  miId,
  permisos,
  onCerrar,
  onEditar,
  onMover,
  onBorrar,
}: {
  tarea: Tarea | null
  miId: number
  permisos: Permisos
  onCerrar: () => void
  onEditar: (t: Tarea) => void
  onMover: (t: Tarea, estado: EstadoTarea) => void
  onBorrar: (t: Tarea) => void
}) {
  if (!tarea) return null
  const t = tarea
  const mover = puedeMover(t, miId, permisos)
  const editar = puedeEditar(t, miId, permisos)

  return (
    <Modal abierto onCerrar={onCerrar} titulo={t.titulo}>
      <div className="scrollbar-thin -mx-1 flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Puntos t={t} />
          <span>
            Creada por <span className="font-medium text-foreground">{t.creador.username}</span>
          </span>
          {t.asignado && (
            <span className="flex items-center gap-1.5">
              · Asignada a
              <Avatar nombre={t.asignado.username} url={t.asignado.avatar_url} tamanio="sm" className="size-5 text-[9px]" />
              <span className="font-medium text-foreground">{t.asignado.username}</span>
            </span>
          )}
          {t.fecha_limite && (
            <span className={cn('flex items-center gap-1', t.vencida && 'font-medium text-destructive')}>
              <AlarmClock className="size-3" aria-hidden />
              {t.vencida ? 'Venció ' : 'Vence '}
              {horaMensaje(t.fecha_limite)}
            </span>
          )}
        </div>

        {t.descripcion ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.descripcion}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sin descripción.</p>
        )}

        {t.imagen_url && (
          <a href={urlArchivo(t.imagen_url)} target="_blank" rel="noreferrer" className="block w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlArchivo(t.imagen_url)} alt="" className="max-h-72 rounded-xl border border-border" />
          </a>
        )}

        {t.puntos_otorgados_a && (
          <p className="text-xs text-muted-foreground">
            {t.puntos_otorgados_a.username} ganó {t.puntos} {t.puntos === 1 ? 'punto' : 'puntos'} por completarla.
          </p>
        )}

        {/* Para el celular, donde no se puede arrastrar: botones para mover la tarea. */}
        {mover && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Mover a</span>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNAS.map(({ estado, titulo, Icono, color }) => (
                <button
                  key={estado}
                  type="button"
                  disabled={estado === t.estado}
                  onClick={() => onMover(t, estado)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                    estado === t.estado
                      ? 'border-primary/50 bg-primary/10 font-medium text-foreground'
                      : 'border-border text-muted-foreground hover:bg-elevated hover:text-foreground',
                  )}
                >
                  <Icono className={cn('size-3.5', color)} aria-hidden />
                  {titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          {editar && (
            <Boton variante="peligro" className="mr-auto h-9 px-3" onClick={() => onBorrar(t)}>
              <Trash2 className="size-4" aria-hidden />
              Borrar
            </Boton>
          )}
          <Boton variante="fantasma" className="h-9 px-3" onClick={onCerrar}>
            Cerrar
          </Boton>
          {editar && (
            <Boton className="h-9 px-3" onClick={() => onEditar(t)}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ======================================================================
// Tarjeta de una tarea (se arrastra entre columnas)
// ======================================================================
function TarjetaTarea({
  t,
  miId,
  permisos,
  arrastrando,
  onAbrir,
  onTomar,
  onEmpezarArrastre,
  onTerminarArrastre,
}: {
  t: Tarea
  miId: number
  permisos: Permisos
  arrastrando: boolean
  onAbrir: () => void
  onTomar: () => void
  onEmpezarArrastre: () => void
  onTerminarArrastre: () => void
}) {
  const movible = puedeMover(t, miId, permisos)

  return (
    <article
      draggable={movible}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(t.id))
        e.dataTransfer.effectAllowed = 'move'
        onEmpezarArrastre()
      }}
      onDragEnd={onTerminarArrastre}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAbrir()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Tarea: ${t.titulo}`}
      className={cn(
        'group flex cursor-pointer flex-col gap-2 rounded-xl border bg-surface p-3 text-left transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none',
        t.vencida ? 'border-destructive/50' : 'border-border',
        movible && 'active:cursor-grabbing',
        arrastrando && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-1.5">
        {movible && (
          <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" aria-hidden />
        )}
        <h4 className={cn('min-w-0 flex-1 text-sm font-medium', t.estado === 'hecha' && 'text-muted-foreground line-through')}>
          {t.titulo}
        </h4>
        <Puntos t={t} className="shrink-0" />
      </div>
      {t.imagen_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlArchivo(t.imagen_url)} alt="" draggable={false} className="h-24 w-full rounded-lg border border-border object-cover" />
      )}
      {t.descripcion && <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{t.descripcion}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {t.asignado ? (
          <span className="flex items-center gap-1.5">
            <Avatar nombre={t.asignado.username} url={t.asignado.avatar_url} tamanio="sm" className="size-5 text-[9px]" />
            {t.asignado.username}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onTomar()
            }}
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
    </article>
  )
}

// ======================================================================
// Tablero
// ======================================================================
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
  const toast = useToast()
  const [soloMias, setSoloMias] = useState(false)
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [abiertaId, setAbiertaId] = useState<number | null>(null)
  const [arrastradaId, setArrastradaId] = useState<number | null>(null)
  const [columnaDestino, setColumnaDestino] = useState<EstadoTarea | null>(null)
  const { data: tareas, mutate } = useSWR(['tareas', servidorId, soloMias], () => getTareas(servidorId, soloMias), {
    refreshInterval: 15000,
  })

  const lista = tareas ?? []
  const abierta = lista.find((t) => t.id === abiertaId) ?? null
  const editando = lista.find((t) => t.id === editandoId) ?? null
  const arrastrada = lista.find((t) => t.id === arrastradaId) ?? null

  /** Reemplaza una tarea en la lista sin volver a pedir todo. */
  function reemplazar(t: Tarea) {
    mutate((actual) => (actual?.some((x) => x.id === t.id) ? actual.map((x) => (x.id === t.id ? t : x)) : [...(actual ?? []), t]), {
      revalidate: false,
    })
  }

  async function mover(t: Tarea, estado: EstadoTarea) {
    if (t.estado === estado) return
    // Se mueve en pantalla al instante y después se confirma con el backend.
    mutate((actual) => actual?.map((x) => (x.id === t.id ? { ...x, estado } : x)), { revalidate: false })
    try {
      const nueva = await editarTarea(t.id, { estado })
      reemplazar(nueva)
      if (estado === 'hecha' && nueva.puntos_otorgados_a && nueva.puntos) {
        toast.exito(`${nueva.puntos_otorgados_a.username} ganó ${nueva.puntos} ${nueva.puntos === 1 ? 'punto' : 'puntos'}.`)
      }
    } catch (err) {
      toast.error(mensajeDeError(err))
      mutate()
    }
  }

  async function tomar(t: Tarea) {
    try {
      reemplazar(await editarTarea(t.id, { asignado_id: miId }))
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  async function borrar(t: Tarea) {
    if (!window.confirm(`¿Borrar la tarea "${t.titulo}"?`)) return
    try {
      await borrarTarea(t.id)
      setAbiertaId(null)
      mutate((actual) => actual?.filter((x) => x.id !== t.id), { revalidate: false })
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  function terminarArrastre() {
    setArrastradaId(null)
    setColumnaDestino(null)
  }

  return (
    <div className="scrollbar-thin @container relative flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Interruptor activo={soloMias} onCambiar={setSoloMias} etiqueta="Solo las mías" />
          <p className="hidden text-xs text-muted-foreground sm:block">Arrastrá las tarjetas para cambiarlas de columna.</p>
          {permisos.puedeEscribir && (
            <Boton className="ml-auto h-9 px-3" onClick={() => setCreando(true)}>
              <ListPlus className="size-4" aria-hidden />
              Nueva tarea
            </Boton>
          )}
        </div>
        <div className="grid gap-4 @3xl:grid-cols-3">
          {COLUMNAS.map(({ estado, titulo, Icono, color }) => {
            const deColumna = lista.filter((t) => t.estado === estado)
            const resaltada = arrastrada !== null && columnaDestino === estado && arrastrada.estado !== estado
            return (
              <section
                key={estado}
                aria-label={titulo}
                onDragOver={(e) => {
                  if (arrastradaId === null) return
                  e.preventDefault() // permite soltar acá
                  e.dataTransfer.dropEffect = 'move'
                  if (columnaDestino !== estado) setColumnaDestino(estado)
                }}
                onDragLeave={(e) => {
                  // Solo se apaga si el mouse salió de la columna (no al pasar sobre una tarjeta).
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setColumnaDestino(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = Number(e.dataTransfer.getData('text/plain'))
                  const t = lista.find((x) => x.id === id)
                  terminarArrastre()
                  if (t) mover(t, estado)
                }}
                className={cn(
                  'flex min-h-40 flex-col gap-2 rounded-2xl border-2 border-transparent bg-surface/50 p-3 transition-colors',
                  resaltada && 'border-dashed border-primary/60 bg-primary/5',
                )}
              >
                <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
                  <Icono className={cn('size-4', color)} aria-hidden />
                  {titulo}
                  <span className="text-muted-foreground">{deColumna.length}</span>
                </h3>
                {deColumna.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                    {arrastradaId !== null ? 'Soltala acá.' : 'Nada por acá.'}
                  </p>
                ) : (
                  deColumna.map((t) => (
                    <TarjetaTarea
                      key={t.id}
                      t={t}
                      miId={miId}
                      permisos={permisos}
                      arrastrando={t.id === arrastradaId}
                      onAbrir={() => setAbiertaId(t.id)}
                      onTomar={() => tomar(t)}
                      onEmpezarArrastre={() => setArrastradaId(t.id)}
                      onTerminarArrastre={terminarArrastre}
                    />
                  ))
                )}
              </section>
            )
          })}
        </div>
      </div>

      {creando && (
        <TareaFormModal
          abierto
          servidorId={servidorId}
          miembros={miembros}
          miId={miId}
          permisos={permisos}
          onCerrar={() => setCreando(false)}
          onGuardada={() => mutate()}
        />
      )}
      {editando && (
        <TareaFormModal
          key={editando.id}
          abierto
          servidorId={servidorId}
          tarea={editando}
          miembros={miembros}
          miId={miId}
          permisos={permisos}
          onCerrar={() => setEditandoId(null)}
          onGuardada={reemplazar}
        />
      )}
      {!editando && (
        <TareaDetalleModal
          tarea={abierta}
          miId={miId}
          permisos={permisos}
          onCerrar={() => setAbiertaId(null)}
          onEditar={(t) => setEditandoId(t.id)}
          onMover={mover}
          onBorrar={borrar}
        />
      )}
    </div>
  )
}
