'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, mensajeDeError, setToken } from '@/lib/api'
import { destinoSeguro } from '@/lib/kort'
import { AuthCard } from './auth-card'
import { Boton, Campo, ErrorFormulario, Input } from './ui'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const { access_token } = await login({ email: email.trim(), password })
      setToken(access_token)
      router.replace(destinoSeguro(next))
    } catch (err) {
      setError(mensajeDeError(err))
      setCargando(false)
    }
  }

  const registroHref = next ? `/registro?next=${encodeURIComponent(next)}` : '/registro'

  return (
    <AuthCard
      titulo="Iniciá sesión"
      subtitulo="Volvé a tus comunidades y seguí la charla donde la dejaste."
      pie={
        <>
          ¿Todavía no tenés cuenta?{' '}
          <Link href={registroHref} className="font-medium text-primary hover:text-primary-hover">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Campo id="email" etiqueta="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@ejemplo.com"
          />
        </Campo>
        <Campo id="password" etiqueta="Contraseña">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Campo>
        <ErrorFormulario mensaje={error} />
        <Boton type="submit" cargando={cargando} className="mt-1 w-full">
          Iniciar sesión
        </Boton>
      </form>
    </AuthCard>
  )
}
