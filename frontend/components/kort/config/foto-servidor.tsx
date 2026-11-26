'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { actualizarServidor, mensajeDeError, subirArchivo, type Servidor } from '@/lib/api'
import { useToast } from '../toast-provider'
import { Avatar, Boton } from '../ui'
import { Seccion } from './confirmar'

/** Foto del servidor (solo el dueño). Se ve en las pestañas, en los flyers y arriba del servidor. */
export function FotoServidor({ servidor, onActualizar }: { servidor: Servidor; onActualizar: () => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  async function cambiar(datos: { icono_url?: string; quitar_icono?: boolean }) {
    try {
      await actualizarServidor(servidor.id, datos)
      toast.exito(datos.quitar_icono ? 'Sacaste la foto del servidor.' : 'Listo: el servidor tiene foto nueva.')
      onActualizar()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <Seccion titulo="Foto del servidor" descripcion="Se ve en las pestañas de arriba, en el encabezado y en los flyers. Si no tiene, se muestran las iniciales.">
      <div className="flex items-center gap-4">
        <Avatar nombre={servidor.nombre} url={servidor.icono_url} tamanio="xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={async (e) => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (!archivo) return
              setSubiendo(true)
              try {
                const subido = await subirArchivo(archivo)
                if (subido.tipo !== 'imagen') throw new Error('Elegí una imagen (PNG, JPG, GIF o WEBP).')
                await cambiar({ icono_url: subido.url })
              } catch (err) {
                toast.error(mensajeDeError(err))
              } finally {
                setSubiendo(false)
              }
            }}
          />
          <Boton variante="secundario" cargando={subiendo} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" aria-hidden />
            {servidor.icono_url ? 'Cambiar foto' : 'Subir foto'}
          </Boton>
          {servidor.icono_url && (
            <Boton variante="fantasma" onClick={() => cambiar({ quitar_icono: true })}>
              <Trash2 className="size-4" aria-hidden />
              Sacar foto
            </Boton>
          )}
        </div>
      </div>
    </Seccion>
  )
}
