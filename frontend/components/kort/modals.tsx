'use client'

import { useState } from 'react'
import { Check, Copy, Hash, Volume2 } from 'lucide-react'
import {
  crearCanal,
  crearInvitacion,
  crearServidor,
  mensajeDeError,
  usarInvitacion,
  type Canal,
  type Invitacion,
  type Servidor,
  type TipoCanal,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { Modal } from './modal'
import { useToast } from './toast-provider'
import { Boton, Campo, ErrorFormulario, Input } from './ui'

type BaseProps = { abierto: boolean; onCerrar: () => void }

export function CrearServidorModal({ abierto, onCerrar, onCreado }: BaseProps & { onCreado: (s: Servidor) => void }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const toast = useToast()

  function cerrar() {
    setNombre('')
    setError(null)
    onCerrar()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const s = await crearServidor(nombre.trim())
      toast.exito(`Listo, creaste "${s.nombre}".`)
      onCreado(s)
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Crear servidor"
      descripcion="Le vamos a crear un canal #general y el rol @everyone para que arranques."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Campo id="servidor-nombre" etiqueta="Nombre del servidor">
          <Input
            id="servidor-nombre"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej.: Club de ajedrez"
          />
        </Campo>
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando}>
            Crear servidor
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

function extraerCodigo(valor: string): string {
  const limpio = valor.trim()
  const match = limpio.match(/\/invitacion\/([^/?#\s]+)/)
  return match ? decodeURIComponent(match[1]) : limpio
}

export function UnirmeModal({ abierto, onCerrar, onUnido }: BaseProps & { onUnido: (s: Servidor) => void }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const toast = useToast()

  function cerrar() {
    setCodigo('')
    setError(null)
    onCerrar()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const s = await usarInvitacion(extraerCodigo(codigo))
      toast.exito(`Te uniste a "${s.nombre}".`)
      onUnido(s)
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Unirme con código"
      descripcion="Pegá el código de invitación (o el link completo) que te pasaron."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Campo id="codigo" etiqueta="Código de invitación">
          <Input
            id="codigo"
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej.: a1B2c3"
            className="font-mono"
          />
        </Campo>
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando} disabled={!codigo.trim()}>
            Unirme
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

export function CrearCanalModal({
  abierto,
  onCerrar,
  servidorId,
  onCreado,
}: BaseProps & { servidorId: number; onCreado: (c: Canal) => void }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCanal>('texto')
  const [soloLectura, setSoloLectura] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const toast = useToast()

  function cerrar() {
    setNombre('')
    setTipo('texto')
    setSoloLectura(false)
    setError(null)
    onCerrar()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const c = await crearCanal(servidorId, {
        nombre: nombre.trim(),
        tipo,
        solo_lectura: tipo === 'texto' ? soloLectura : false,
      })
      toast.exito(`Creaste el canal ${c.tipo === 'texto' ? '#' : ''}${c.nombre}.`)
      onCreado(c)
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  const opciones: { valor: TipoCanal; etiqueta: string; desc: string; Icono: typeof Hash }[] = [
    { valor: 'texto', etiqueta: 'Texto', desc: 'Mensajes, links y charla escrita', Icono: Hash },
    { valor: 'voz', etiqueta: 'Voz', desc: 'Para hablar (próximamente)', Icono: Volume2 },
  ]

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Crear canal">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Tipo de canal</legend>
          {opciones.map(({ valor, etiqueta, desc, Icono }) => (
            <label
              key={valor}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                tipo === valor ? 'border-primary/60 bg-primary/8' : 'border-border hover:bg-elevated',
              )}
            >
              <input
                type="radio"
                name="tipo"
                value={valor}
                checked={tipo === valor}
                onChange={() => setTipo(valor)}
                className="sr-only"
              />
              <Icono className={cn('size-4', tipo === valor ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{etiqueta}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Campo id="canal-nombre" etiqueta="Nombre del canal">
          <Input
            id="canal-nombre"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tipo === 'texto' ? 'anuncios' : 'sala-de-estar'}
          />
        </Campo>
        {tipo === 'texto' && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
            <input
              type="checkbox"
              checked={soloLectura}
              onChange={(e) => setSoloLectura(e.target.checked)}
              className="mt-0.5 size-4 accent-[#FF6B5B]"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">Solo lectura</span>
              <span className="text-xs text-muted-foreground">Solo el dueño y los moderadores pueden escribir.</span>
            </span>
          </label>
        )}
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando}>
            Crear canal
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

function fechaLocalPorDefecto(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function InvitarModal({ abierto, onCerrar, servidor }: BaseProps & { servidor: Servidor }) {
  const [usos, setUsos] = useState('10')
  const [vence, setVence] = useState(fechaLocalPorDefecto)
  const [invitacion, setInvitacion] = useState<Invitacion | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const toast = useToast()

  function cerrar() {
    setInvitacion(null)
    setError(null)
    setCopiado(false)
    setUsos('10')
    setVence(fechaLocalPorDefecto())
    onCerrar()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const fecha = vence.length === 16 ? `${vence}:00` : vence
      const inv = await crearInvitacion(servidor.id, { usos_maximos: Number(usos), fecha_vencimiento: fecha })
      setInvitacion(inv)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  const link = invitacion && typeof window !== 'undefined' ? `${window.location.origin}/invitacion/${invitacion.codigo}` : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('No pudimos copiar el link. Seleccionalo y copialo a mano.')
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Invitar gente"
      descripcion={`Generá un código para que se sumen a "${servidor.nombre}".`}
    >
      {invitacion ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background px-4 py-5">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Código</span>
            <span className="font-mono text-2xl font-semibold tracking-wide text-primary">{invitacion.codigo}</span>
            <span className="text-xs text-muted-foreground">
              {invitacion.usos}/{invitacion.usos_maximos} usos
            </span>
          </div>
          <Campo id="link-invitacion" etiqueta="Link para compartir">
            <div className="flex gap-2">
              <Input id="link-invitacion" readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
              <Boton type="button" variante="secundario" onClick={copiar} className="shrink-0">
                {copiado ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copiado ? 'Copiado' : 'Copiar'}
              </Boton>
            </div>
          </Campo>
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setInvitacion(null)}>
              Generar otra
            </Boton>
            <Boton type="button" onClick={cerrar}>
              Listo
            </Boton>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Campo id="usos" etiqueta="Cantidad máxima de usos">
            <Input id="usos" type="number" min={1} inputMode="numeric" value={usos} onChange={(e) => setUsos(e.target.value)} />
          </Campo>
          <Campo id="vence" etiqueta="Vence el">
            <Input
              id="vence"
              type="datetime-local"
              value={vence}
              onChange={(e) => setVence(e.target.value)}
              className="[color-scheme:dark]"
            />
          </Campo>
          <ErrorFormulario mensaje={error} />
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={cargando}>
              Generar invitación
            </Boton>
          </div>
        </form>
      )}
    </Modal>
  )
}
