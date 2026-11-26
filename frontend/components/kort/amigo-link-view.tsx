'use client'

/**
 * Página que se abre con un link de amistad (/amigo/<usuario>).
 * Si no hay sesión, primero manda al login y después vuelve acá.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { UserPlus } from 'lucide-react'
import { enviarSolicitud, getMe, getToken, mensajeDeError } from '@/lib/api'
import { AuthCard } from './auth-card'
import { Avatar, Boton, ErrorFormulario } from './ui'

export function AmigoLinkView({ usuario }: { usuario: string }) {
  const router = useRouter()
  const nombre = usuario.trim().toLowerCase()
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<'enviada' | 'amigos' | null>(null)

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/login?next=${encodeURIComponent(`/amigo/${encodeURIComponent(nombre)}`)}`)
      return
    }
    setListo(true)
  }, [nombre, router])

  const { data: yo } = useSWR(listo ? 'me' : null, getMe)
  const esMiLink = yo?.username.toLowerCase() === nombre

  async function enviar() {
    setError(null)
    setCargando(true)
    try {
      const { estado } = await enviarSolicitud(nombre)
      setResultado(estado)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthCard
      titulo="Solicitud de amistad"
      subtitulo="Alguien te pasó su link de amistad de Kort."
      pie={
        <button type="button" onClick={() => router.push('/app')} className="hover:text-foreground">
          Ir a Kort
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
          <Avatar nombre={nombre} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Usuario</p>
            <p className="truncate font-semibold">{nombre}</p>
          </div>
        </div>

        {esMiLink ? (
          <p className="text-sm text-muted-foreground">
            Este es tu propio link. Pasáselo a otra persona para que te mande una solicitud.
          </p>
        ) : resultado ? (
          <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
            {resultado === 'amigos' ? `¡Ahora sos amigo de ${nombre}!` : `Le mandaste una solicitud a ${nombre}.`}
          </p>
        ) : (
          <>
            {yo && (
              <p className="text-sm text-muted-foreground">
                La vas a mandar como <span className="font-medium text-foreground">{yo.username}</span>.
              </p>
            )}
            <ErrorFormulario mensaje={error} />
            <Boton onClick={enviar} cargando={cargando} disabled={!listo} className="w-full">
              <UserPlus className="size-4" aria-hidden />
              Mandar solicitud de amistad
            </Boton>
          </>
        )}

        {(resultado || esMiLink) && (
          <Boton variante="secundario" onClick={() => router.push('/app')} className="w-full">
            Ir a Kort
          </Boton>
        )}
      </div>
    </AuthCard>
  )
}
