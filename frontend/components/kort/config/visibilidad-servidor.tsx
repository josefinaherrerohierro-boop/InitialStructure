'use client'

import { useState } from 'react'
import { Globe, Lock } from 'lucide-react'
import { actualizarServidor, mensajeDeError, type Servidor } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCambiosPendientes } from '../cambios-pendientes'
import { useToast } from '../toast-provider'
import { Boton } from '../ui'
import { Seccion } from './confirmar'

/** Público o privado, y la descripción que se ve en Explorar (solo el dueño). */
export function VisibilidadServidor({ servidor, onActualizar }: { servidor: Servidor; onActualizar: () => void }) {
  const toast = useToast()
  const [publico, setPublico] = useState(!!servidor.publico)
  const [descripcion, setDescripcion] = useState(servidor.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)
  const [cambiandoVisibilidad, setCambiandoVisibilidad] = useState(false)
  // Solo la descripción necesita "Guardar": Público/Privado se guarda apenas lo tocás.
  const cambio = descripcion.trim() !== (servidor.descripcion ?? '')
  useCambiosPendientes(cambio)

  async function cambiarVisibilidad(valor: boolean) {
    if (valor === publico || cambiandoVisibilidad) return
    const anterior = publico
    setPublico(valor) // se ve al instante; si falla, vuelve atrás
    setCambiandoVisibilidad(true)
    try {
      await actualizarServidor(servidor.id, { publico: valor })
      toast.exito(valor ? 'Ahora el servidor es público: aparece en Explorar.' : 'Ahora el servidor es privado: solo se entra con invitación.')
      onActualizar()
    } catch (err) {
      setPublico(anterior)
      toast.error(mensajeDeError(err))
    } finally {
      setCambiandoVisibilidad(false)
    }
  }

  async function guardarDescripcion() {
    setGuardando(true)
    try {
      await actualizarServidor(servidor.id, { descripcion: descripcion.trim() })
      toast.exito('Descripción guardada.')
      onActualizar()
    } catch (err) {
      toast.error(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion titulo="¿Quién puede entrar?" descripcion="Se guarda apenas elegís. Un servidor público aparece en Explorar y cualquiera entra con un clic; uno privado, solo con invitación.">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            [false, 'Privado', 'Solo con invitación', Lock],
            [true, 'Público', 'Aparece en Explorar', Globe],
          ] as const
        ).map(([valor, titulo, detalle, Icono]) => (
          <button
            key={titulo}
            type="button"
            onClick={() => cambiarVisibilidad(valor)}
            disabled={cambiandoVisibilidad}
            aria-pressed={publico === valor}
            className={cn(
              'flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
              publico === valor ? 'border-primary bg-primary/8' : 'border-border hover:bg-elevated',
            )}
          >
            <Icono className="size-5 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block text-sm font-semibold">{titulo}</span>
              <span className="block text-xs text-muted-foreground">{detalle}</span>
            </span>
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Descripción
        <textarea
          rows={3}
          maxLength={300}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="¿De qué se trata tu comunidad?"
          className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-normal outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs font-normal text-muted-foreground">{descripcion.length}/300</span>
      </label>
      <div>
        <Boton onClick={guardarDescripcion} cargando={guardando} disabled={!cambio}>
          Guardar descripción
        </Boton>
      </div>
    </Seccion>
  )
}
