import { Suspense } from 'react'
import type { Metadata } from 'next'
import { RegistroForm } from '@/components/kort/registro-form'

export const metadata: Metadata = { title: 'Creá tu cuenta — kort' }

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroForm />
    </Suspense>
  )
}
