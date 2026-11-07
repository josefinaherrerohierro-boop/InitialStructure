'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/api'
import { Logo } from '@/components/kort/ui'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace(getToken() ? '/app' : '/login')
  }, [router])
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Logo className="text-4xl animate-pulse" />
    </main>
  )
}
