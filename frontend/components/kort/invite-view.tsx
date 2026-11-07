'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Ticket } from 'lucide-react'
import { getMe, getToken, mensajeDeError, usarInvitacion } from '@/lib/api'
import { AuthCard } from './auth-card'
import { Boton, ErrorFormulario } from './ui'

export function InviteView({ codigo }: { codigo: string }) {
  const router = useRouter()
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/login?next=${encodeURIComponent(`/invitacion/${codigo}`)}`)
      return
    }
    setListo(true)
  }, [codigo, router])

  const { data: yo } = useSWR(listo ? 'me' : null, getMe)

  async function unirme() {
    setError(null)
    setCargando(true)
    try {
      const s = await usarInvitacion(codigo)
      router.push(`/app?servidor=${s.id}`)
    } catch (err) {
      setError(mensajeDeError(err))
      setCargando(false)
    }
  }

  return (
    <AuthCard
      titulo="Te invitaron a Kort"
      subtitulo="Alguien te pasó un código para sumarte a su servidor."
      pie={
        <button type="button" onClick={() => router.push('/app')} className="hover:text-foreground">
          Ir a mis servidores
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Ticket className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Código</p>
            <p className="truncate font-mono font-semibold">{codigo}</p>
          </div>
        </div>
        {yo && (
          <p className="text-sm text-muted-foreground">
            Te vas a unir como <span className="font-medium text-foreground">{yo.username}</span>.
          </p>
        )}
        <ErrorFormulario mensaje={error} />
        <Boton onClick={unirme} cargando={cargando} disabled={!listo} className="w-full">
          Unirme al servidor
        </Boton>
      </div>
    </AuthCard>
  )
}
