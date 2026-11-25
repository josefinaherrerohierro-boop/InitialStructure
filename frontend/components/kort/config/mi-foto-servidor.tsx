'use client'

import useSWR from 'swr'
import { Check } from 'lucide-react'
import { elegirMiFoto, getMiMembresia, getPerfil, mensajeDeError, urlArchivo } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useToast } from '../toast-provider'
import { Seccion } from './confirmar'

/**
 * "Tu foto en este servidor": cada uno elige cuál de sus fotos se ve acá.
 * Ej.: una foto seria en el servidor del trabajo y otra en el de juegos.
 */
export function MiFotoServidor({
  servidorId,
  miId,
  onCambio,
}: {
  servidorId: number
  miId: number
  onCambio: () => void
}) {
  const toast = useToast()
  const { data: perfil } = useSWR(['perfil', miId], () => getPerfil(miId))
  const { data: membresia, mutate } = useSWR(['mi-membresia', servidorId], () => getMiMembresia(servidorId))
  const fotos = perfil?.fotos ?? []
  const elegida = membresia?.foto_id ?? null

  async function elegir(fotoId: number | null) {
    try {
      await mutate(elegirMiFoto(servidorId, fotoId), { revalidate: false })
      toast.exito(fotoId ? 'Listo: en este servidor se va a ver esa foto.' : 'Listo: acá vuelve a verse tu foto principal.')
      onCambio()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <Seccion
      titulo="Tu foto en este servidor"
      descripcion="Elegí cuál de tus fotos ven los demás acá (en los mensajes, en la lista de miembros y en el scoreboard). Los otros servidores no cambian."
    >
      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no subiste fotos. Agregalas en Configuración de usuario → Mi perfil.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {fotos.map((f) => {
            const activa = elegida === f.id || (elegida === null && f.principal)
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => elegir(f.principal ? null : f.id)}
                  aria-pressed={activa}
                  aria-label={f.principal ? 'Usar mi foto principal' : 'Usar esta foto en este servidor'}
                  className={cn(
                    'relative block size-20 overflow-hidden rounded-2xl ring-offset-2 ring-offset-surface transition',
                    activa ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlArchivo(f.url)} alt="" className="size-full object-cover" />
                  {activa && (
                    <span className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" aria-hidden />
                    </span>
                  )}
                  {f.principal && (
                    <span className="absolute inset-x-0 top-0 bg-black/55 py-0.5 text-center text-[10px] text-white">Principal</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Seccion>
  )
}
