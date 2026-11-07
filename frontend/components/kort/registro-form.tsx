'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, mensajeDeError, registrarUsuario, setToken } from '@/lib/api'
import { destinoSeguro } from '@/lib/kort'
import { AuthCard } from './auth-card'
import { Boton, Campo, ErrorFormulario, Input } from './ui'

export function RegistroForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await registrarUsuario({ email: email.trim(), username: username.trim(), password })
      const { access_token } = await login({ email: email.trim(), password })
      setToken(access_token)
      router.replace(destinoSeguro(next))
    } catch (err) {
      setError(mensajeDeError(err))
      setCargando(false)
    }
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  return (
    <AuthCard
      titulo="Creá tu cuenta"
      subtitulo="Sumate a Kort y armá tus propias comunidades."
      pie={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link href={loginHref} className="font-medium text-primary hover:text-primary-hover">
            Iniciá sesión
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
        <Campo
          id="username"
          etiqueta="Nombre de usuario"
          ayuda="De 3 a 32 caracteres: letras, números, punto y guion bajo, sin espacios."
        >
          <Input
            id="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-describedby="username-ayuda"
            placeholder="tu.usuario"
          />
        </Campo>
        <Campo id="password" etiqueta="Contraseña" ayuda="De 8 a 72 caracteres.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-ayuda"
          />
        </Campo>
        <ErrorFormulario mensaje={error} />
        <Boton type="submit" cargando={cargando} className="mt-1 w-full">
          Crear cuenta
        </Boton>
      </form>
    </AuthCard>
  )
}
