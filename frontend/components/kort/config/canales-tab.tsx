'use client'

import { useState } from 'react'
import { Hash, Pencil, Trash2, Volume2 } from 'lucide-react'
import { actualizarCanal, borrarCanal, mensajeDeError, type Canal } from '@/lib/api'
import { useToast } from '../toast-provider'
import { Boton, Input } from '../ui'
import { Confirmar, Interruptor, Seccion } from './confirmar'

/** HU3: administrar canales (dueño y moderadores). */
export function CanalesTab({ canales, onActualizar }: { canales: Canal[]; onActualizar: () => void }) {
  return (
    <Seccion titulo="Canales" descripcion="Renombrá, cambiá a solo lectura o borrá los canales del servidor.">
      <ul className="flex flex-col divide-y divide-border">
        {canales.map((c) => (
          <FilaCanal key={c.id} canal={c} onActualizar={onActualizar} />
        ))}
      </ul>
    </Seccion>
  )
}

function FilaCanal({ canal, onActualizar }: { canal: Canal; onActualizar: () => void }) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(canal.nombre)
  const [borrando, setBorrando] = useState(false)
  const Icono = canal.tipo === 'voz' ? Volume2 : Hash

  async function guardar(cambios: { nombre?: string; solo_lectura?: boolean }) {
    try {
      await actualizarCanal(canal.id, cambios)
      onActualizar()
      setEditando(false)
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {editando ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            guardar({ nombre: nombre.trim() })
          }}
        >
          <Input autoFocus aria-label="Nombre del canal" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-9" />
          <Boton type="submit" className="h-9">
            Guardar
          </Boton>
          <Boton type="button" variante="fantasma" className="h-9" onClick={() => setEditando(false)}>
            Cancelar
          </Boton>
        </form>
      ) : (
        <span className="flex-1 truncate text-sm font-medium">{canal.nombre}</span>
      )}

      {!editando && (
        <>
          {canal.tipo === 'texto' && (
            <Interruptor
              etiqueta="Solo lectura"
              activo={canal.solo_lectura}
              onCambiar={(v) => guardar({ solo_lectura: v })}
            />
          )}
          <button
            type="button"
            onClick={() => {
              setNombre(canal.nombre)
              setEditando(true)
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground"
            aria-label={`Renombrar ${canal.nombre}`}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setBorrando(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label={`Borrar ${canal.nombre}`}
          >
            <Trash2 className="size-4" />
          </button>
        </>
      )}

      <Confirmar
        abierto={borrando}
        titulo={`¿Borrar ${canal.tipo === 'texto' ? '#' : ''}${canal.nombre}?`}
        descripcion="Se borran también todos sus mensajes."
        textoBoton="Borrar canal"
        onCerrar={() => setBorrando(false)}
        onConfirmar={async () => {
          await borrarCanal(canal.id)
          toast.exito('Canal borrado.')
          onActualizar()
        }}
      />
    </li>
  )
}
