'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Trash2, Users } from 'lucide-react'
import {
  alternarAsistencia,
  borrarEvento,
  crearEvento,
  editarEvento,
  getEventos,
  mensajeDeError,
  type Evento,
} from '@/lib/api'
import { parseFecha, type Permisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { aInputFecha } from './encuesta-modal'
import { Modal } from './modal'
import { useToast } from './toast-provider'
import { Avatar, Boton, Campo, ErrorFormulario, Input } from './ui'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })

const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const sinHora = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** ¿El evento ocurre (aunque sea en parte) ese día? */
function ocurreEl(e: Evento, dia: Date): boolean {
  const inicio = sinHora(parseFecha(e.inicio))
  const fin = sinHora(parseFecha(e.fin ?? e.inicio))
  return inicio <= dia && dia <= fin
}

function rangoDeHoras(e: Evento): string {
  const inicio = parseFecha(e.inicio)
  if (!e.fin) return formatoHora.format(inicio)
  const fin = parseFecha(e.fin)
  return mismoDia(inicio, fin)
    ? `${formatoHora.format(inicio)} a ${formatoHora.format(fin)}`
    : `${formatoHora.format(inicio)} → ${formatoDia.format(fin)} ${formatoHora.format(fin)}`
}

function FormularioEvento({
  abierto,
  servidorId,
  evento,
  diaInicial,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  servidorId: number
  evento?: Evento | null
  diaInicial: Date
  onCerrar: () => void
  onGuardado: () => void
}) {
  const base = new Date(diaInicial)
  base.setHours(18, 0, 0, 0)
  const [titulo, setTitulo] = useState(evento?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(evento?.descripcion ?? '')
  const [lugar, setLugar] = useState(evento?.lugar ?? '')
  const [inicio, setInicio] = useState(evento ? aInputFecha(parseFecha(evento.inicio)) : aInputFecha(base))
  const [fin, setFin] = useState(evento?.fin ? aInputFecha(parseFecha(evento.fin)) : '')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const datos = { titulo: titulo.trim(), descripcion, lugar, inicio: `${inicio}:00`, fin: fin ? `${fin}:00` : null }
    try {
      if (evento) await editarEvento(evento.id, datos)
      else await crearEvento(servidorId, datos)
      onGuardado()
      onCerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={evento ? 'Editar evento' : 'Nuevo evento'}>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <Campo id="evento-titulo" etiqueta="Título">
          <Input id="evento-titulo" autoFocus maxLength={100} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Juntada para estudiar" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="evento-inicio" etiqueta="Empieza">
            <Input id="evento-inicio" type="datetime-local" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo id="evento-fin" etiqueta="Termina (opcional)">
            <Input id="evento-fin" type="datetime-local" min={inicio} value={fin} onChange={(e) => setFin(e.target.value)} />
          </Campo>
        </div>
        <Campo id="evento-lugar" etiqueta="Lugar (opcional)">
          <Input id="evento-lugar" maxLength={100} value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej.: canal de voz, la escuela…" />
        </Campo>
        <Campo id="evento-desc" etiqueta="Descripción (opcional)">
          <textarea
            id="evento-desc"
            rows={3}
            maxLength={1000}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          />
        </Campo>
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando} disabled={!titulo.trim()}>
            {evento ? 'Guardar' : 'Crear evento'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

function TarjetaEvento({
  e,
  puedeEditar,
  onCambio,
  onEditar,
}: {
  e: Evento
  puedeEditar: boolean
  onCambio: () => void
  onEditar: () => void
}) {
  const toast = useToast()
  async function hacer(accion: () => Promise<unknown>) {
    try {
      await accion()
      onCambio()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }
  const pasado = parseFecha(e.fin ?? e.inicio) < new Date()
  return (
    <article className={cn('flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4', pasado && 'opacity-60')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold">{e.titulo}</h4>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {rangoDeHoras(e)}
          </p>
          {e.lugar && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              {e.lugar}
            </p>
          )}
        </div>
        {puedeEditar && (
          <div className="flex gap-0.5">
            <button type="button" onClick={onEditar} className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground" aria-label="Editar evento">
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => hacer(() => borrarEvento(e.id))}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              aria-label="Borrar evento"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {e.descripcion && <p className="whitespace-pre-wrap text-sm text-foreground/90">{e.descripcion}</p>}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {e.asistentes.slice(0, 5).map((a) => (
            <Avatar key={a.id} nombre={a.username} url={a.avatar_url} tamanio="sm" className="ring-2 ring-surface" />
          ))}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" aria-hidden />
          {e.asistentes.length} {e.asistentes.length === 1 ? 'va' : 'van'}
        </span>
        {!pasado && (
          <Boton
            variante={e.voy ? 'secundario' : 'primario'}
            onClick={() => hacer(() => alternarAsistencia(e.id))}
            className="ml-auto h-8 px-3 text-xs"
          >
            {e.voy ? 'Ya no voy' : 'Voy'}
          </Boton>
        )}
      </div>
    </article>
  )
}

export function CalendarioView({
  servidorId,
  miId,
  permisos,
}: {
  servidorId: number
  miId: number
  permisos: Permisos
}) {
  const hoy = sinHora(new Date())
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [elegido, setElegido] = useState<Date>(hoy)
  const [formulario, setFormulario] = useState<{ abierto: boolean; evento: Evento | null }>({ abierto: false, evento: null })

  // La grilla arranca el lunes anterior al día 1 y muestra 6 semanas.
  const dias = useMemo(() => {
    const desfase = (mes.getDay() + 6) % 7
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1 - desfase)
    return Array.from({ length: 42 }, (_, i) => new Date(primero.getFullYear(), primero.getMonth(), primero.getDate() + i))
  }, [mes])
  const desde = aInputFecha(dias[0]) + ':00'
  const hasta = aInputFecha(new Date(dias[41].getFullYear(), dias[41].getMonth(), dias[41].getDate() + 1)) + ':00'

  const { data: eventos, mutate } = useSWR(['eventos', servidorId, desde], () => getEventos(servidorId, desde, hasta), {
    refreshInterval: 30000,
  })
  const delDia = (eventos ?? []).filter((e) => ocurreEl(e, elegido))
  const proximos = (eventos ?? []).filter((e) => parseFecha(e.fin ?? e.inicio) >= new Date()).slice(0, 5)

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Calendario" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-lg font-semibold capitalize">{formatoMes.format(mes)}</h2>
            <Boton variante="fantasma" className="h-9 px-3" onClick={() => { setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); setElegido(hoy) }}>
              Hoy
            </Boton>
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="rounded-lg p-2 hover:bg-elevated" aria-label="Mes anterior">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="rounded-lg p-2 hover:bg-elevated" aria-label="Mes siguiente">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">
            {DIAS.map((d) => (
              <div key={d} className="border-b border-border bg-surface py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
            {dias.map((d) => {
              const evs = (eventos ?? []).filter((e) => ocurreEl(e, d))
              const otroMes = d.getMonth() !== mes.getMonth()
              const esHoy = mismoDia(d, hoy)
              const esElegido = mismoDia(d, elegido)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setElegido(d)}
                  aria-pressed={esElegido}
                  aria-label={`${formatoDia.format(d)}${evs.length ? `, ${evs.length} eventos` : ''}`}
                  className={cn(
                    'flex min-h-16 flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-24 [&:nth-child(7n+7)]:border-r-0',
                    otroMes ? 'bg-background/40 text-muted-foreground/60' : 'bg-background',
                    esElegido ? 'bg-primary/10' : 'hover:bg-surface',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs',
                      esHoy && 'bg-primary font-semibold text-primary-foreground',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {evs.slice(0, 2).map((e) => (
                    <span key={e.id} className="hidden truncate rounded bg-primary/20 px-1 text-[11px] text-foreground sm:block">
                      {e.titulo}
                    </span>
                  ))}
                  {evs.length > 0 && (
                    <span className="flex gap-0.5 sm:hidden" aria-hidden>
                      {evs.slice(0, 3).map((e) => (
                        <span key={e.id} className="size-1.5 rounded-full bg-primary" />
                      ))}
                    </span>
                  )}
                  {evs.length > 2 && <span className="hidden text-[10px] text-muted-foreground sm:block">+{evs.length - 2} más</span>}
                </button>
              )
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold capitalize">{formatoDia.format(elegido)}</h3>
            {permisos.puedeEscribir && (
              <Boton className="h-9 px-3" onClick={() => setFormulario({ abierto: true, evento: null })}>
                <CalendarPlus className="size-4" aria-hidden />
                Evento
              </Boton>
            )}
          </div>
          {delDia.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay eventos este día.</p>
          ) : (
            delDia.map((e) => (
              <TarjetaEvento
                key={e.id}
                e={e}
                puedeEditar={e.creador.id === miId || permisos.esModerador}
                onCambio={() => mutate()}
                onEditar={() => setFormulario({ abierto: true, evento: e })}
              />
            ))
          )}
          {proximos.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Próximos</h3>
              {proximos.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setElegido(sinHora(parseFecha(e.inicio)))}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface"
                >
                  <span className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-primary/15 py-1 text-primary">
                    <span className="text-[10px] uppercase">{parseFecha(e.inicio).toLocaleDateString('es-AR', { month: 'short' })}</span>
                    <span className="text-sm font-semibold">{parseFecha(e.inicio).getDate()}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{e.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{formatoHora.format(parseFecha(e.inicio))}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      {formulario.abierto && (
        <FormularioEvento
          abierto
          servidorId={servidorId}
          evento={formulario.evento}
          diaInicial={elegido}
          onCerrar={() => setFormulario({ abierto: false, evento: null })}
          onGuardado={() => mutate()}
        />
      )}
    </div>
  )
}
