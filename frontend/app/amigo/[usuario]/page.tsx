import type { Metadata } from 'next'
import { AmigoLinkView } from '@/components/kort/amigo-link-view'

export const metadata: Metadata = { title: 'Solicitud de amistad — kort' }

export default async function AmigoPage({ params }: { params: Promise<{ usuario: string }> }) {
  const { usuario } = await params
  return <AmigoLinkView usuario={decodeURIComponent(usuario)} />
}
