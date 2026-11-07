import type { Metadata } from 'next'
import { InviteView } from '@/components/kort/invite-view'

export const metadata: Metadata = { title: 'Invitación — kort' }

export default async function InvitacionPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  return <InviteView codigo={decodeURIComponent(codigo)} />
}
