'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { crearEncuesta, mensajeDeError, type Mensaje } from '@/lib/api'
import { Modal } from './modal'
import { Interruptor } from './config/confirmar'
import { Boton, Campo, ErrorFormulario, Input } from './ui'

const MAX_OPCIONES = 10

/** Fecha y hora local en el formato de <input type="datetime-local">. */
export function aInputFecha(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CrearEncuestaModal({
  abierto,
  canalId,
  onCerrar,
  onCreada,
}: {
  abierto: boolean
  canalId: number
  onCerrar: () => void
  onCreada: (m: Mensaje) => void
}) {
  const [pregunta, setPregunta] = useState('')
  const [opciones, setOpciones] = useState(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [conLimite, setConLimite] = useState(false)
  const [limite, setLimite] = useState(() => aInputFecha(new Date(Date.now() + 24 * 3600 * 1000)))
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  function cerrar() {
    setPregunta('')
    setOpciones(['', ''])
    setMultiple(false)
    setConLimite(false)
    setError(null)
    onCerrar()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const limpias = opciones.map((o) => o.trim()).filter(Boolean)
    if (limpias.length < 2) {
      setError('Poné al menos dos opciones.')
      return
    }
    setCargando(true)
    try {
      const m = await crearEncuesta(canalId, {
        pregunta: pregunta.trim(),
        opciones: limpias,
        multiple,
        fecha_limite: conLimite ? `${limite}:00` : null,
      })
      onCreada(m)
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Crear encuesta" descripcion="Se publica en el canal como un mensaje.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Campo id="encuesta-pregunta" etiqueta="Pregunta">
          <Input
            id="encuesta-pregunta"
            autoFocus
            maxLength={300}
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Ej.: ¿Qué día juntamos?"
          />
        </Campo>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Opciones</legend>
          {opciones.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label={`Opción ${i + 1}`}
                maxLength={100}
                value={o}
                onChange={(e) => setOpciones((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Opción ${i + 1}`}
                className="h-10"
              />
              {opciones.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOpciones((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg px-2 text-muted-foreground hover:bg-elevated hover:text-foreground"
                  aria-label={`Quitar opción ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          {opciones.length < MAX_OPCIONES && (
            <button
              type="button"
              onClick={() => setOpciones((prev) => [...prev, ''])}
              className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-primary hover:bg-primary/10"
            >
              <Plus className="size-4" aria-hidden />
              Agregar opción
            </button>
          )}
        </fieldset>

        <div className="flex flex-col gap-3">
          <Interruptor activo={multiple} onCambiar={setMultiple} etiqueta="Permitir elegir varias opciones" />
          <Interruptor activo={conLimite} onCambiar={setConLimite} etiqueta="Ponerle fecha límite" />
          {conLimite && (
            <Input
              type="datetime-local"
              aria-label="Fecha límite"
              value={limite}
              min={aInputFecha(new Date())}
              onChange={(e) => setLimite(e.target.value)}
            />
          )}
        </div>

        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando}>
            Publicar encuesta
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
