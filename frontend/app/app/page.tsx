import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AppShell } from '@/components/kort/app-shell'

export const metadata: Metadata = { title: 'kort' }

export default function AppPage() {
  return (
    <Suspense>
      <AppShell />
    </Suspense>
  )
}
