import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/kort/toast-provider'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'kort — tus comunidades',
  description: 'Kort: servidores, canales de texto y voz, roles e invitaciones para tu comunidad.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#15161C',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
