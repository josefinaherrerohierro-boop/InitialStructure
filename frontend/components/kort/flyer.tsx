'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ArrowRight, Megaphone, Users } from 'lucide-react'
import { getServidoresDeUsuario, mensajeDeError, usarInvitacion, type Flyer, type Usuario } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useToast } from './toast-provider'
import { Avatar, Boton } from './ui'

/** Abre el servidor (recarga la lista de servidores, por si recién te uniste). */
function irAlServidor(servidorId: number) {
  window.location.href = `/app?servidor=${servidorId}`
}

/**
 * Tarjeta de un flyer: invita a un servidor. Cualquiera puede unirse desde
 * acá, aunque no sea amigo de quien lo publicó.
 */
export function TarjetaFlyer({ flyer, oscura = false }: { flyer: Flyer; oscura?: boolean }) {
  const toast = useToast()
  const [uniendo, setUniendo] = useState(false)

  async function unirme() {
    setUniendo(true)
    try {
      const s = await usarInvitacion(flyer.codigo)
      toast.exito(`¡Te uniste a "${s.nombre}"!`)
      irAlServidor(s.id)
    } catch (err) {
      toast.error(mensajeDeError(err))
      setUniendo(false)
    }
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3',
        oscura ? 'border-white/20 bg-black/45 text-white backdrop-blur' : 'border-primary/30 bg-primary/8',
      )}
    >
      <Avatar nombre={flyer.servidor_nombre} url={flyer.servidor_icono_url} tamanio="lg" className="rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1 text-[11px] font-semibold', oscura ? 'text-white/80' : 'text-primary')}>
          <Megaphone className="size-3" aria-hidden />
          Te invitan a un servidor
        </p>
        <p className="truncate font-display text-base font-bold">{flyer.servidor_nombre}</p>
        <p className={cn('flex items-center gap-1 text-xs', oscura ? 'text-white/70' : 'text-muted-foreground')}>
          <Users className="size-3" aria-hidden />
          {flyer.miembros} {flyer.miembros === 1 ? 'miembro' : 'miembros'}
        </p>
      </div>
      {flyer.soy_miembro ? (
        <Boton variante="secundario" className="h-9 shrink-0 px-3" onClick={() => irAlServidor(flyer.servidor_id)}>
          Ir al servidor
          <ArrowRight className="size-3.5" aria-hidden />
        </Boton>
      ) : flyer.vigente ? (
        <Boton className="h-9 shrink-0 px-4" cargando={uniendo} onClick={unirme}>
          Unirme
        </Boton>
      ) : (
        <span className={cn('shrink-0 text-xs', oscura ? 'text-white/70' : 'text-muted-foreground')}>Invitación vencida</span>
      )}
    </div>
  )
}

/** Para elegir qué servidor promocionar en una publicación o un estado. */
export function ElegirServidorFlyer({
  yo,
  valor,
  onCambiar,
}: {
  yo: Usuario
  valor: number | null
  onCambiar: (servidorId: number | null) => void
}) {
  const { data: servidores } = useSWR(['servidores', yo.id], () => getServidoresDeUsuario(yo.id))
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <Megaphone className="size-4 text-primary" aria-hidden />
        Promocionar un servidor (flyer)
      </span>
      <select
        value={valor ?? ''}
        onChange={(e) => onCambiar(e.target.value ? Number(e.target.value) : null)}
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
      >
        <option value="">No promocionar ninguno</option>
        {servidores?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        Cualquiera que lo vea va a poder unirse con un botón. Necesitás permiso para invitar en ese servidor.
      </span>
    </label>
  )
}
