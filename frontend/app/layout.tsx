import type { Metadata, Viewport } from 'next'
import { Atkinson_Hyperlegible, Bricolage_Grotesque, Geist, Geist_Mono, Inter, Lora, Nunito, Space_Grotesk } from 'next/font/google'
import { ToastProvider } from '@/components/kort/toast-provider'
import { SCRIPT_APARIENCIA_INICIAL } from '@/lib/apariencia'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
// Tipografía de los títulos y del logo: parte de la identidad de Kort.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
// Tipografías que cada usuario puede elegir en "Apariencia".
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', preload: false })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', preload: false })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', preload: false })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', preload: false })
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  preload: false,
})

const fuentes = [geistSans, geistMono, bricolage, inter, nunito, lora, spaceGrotesk, atkinson].map((f) => f.variable).join(' ')

export const metadata: Metadata = {
  title: 'kort — tus comunidades',
  description: 'Kort: servidores, canales de texto y voz, roles e invitaciones para tu comunidad.',
}

export const viewport: Viewport = {
  themeColor: '#efe8dc',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: el script de abajo cambia atributos de <html>
    // (tema, fuente...) antes de que React tome el control.
    <html lang="es-AR" className={fuentes} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_APARIENCIA_INICIAL }} />
      </head>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
