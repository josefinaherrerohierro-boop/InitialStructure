import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/kort/login-form'

export const metadata: Metadata = { title: 'Iniciá sesión — kort' }

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
