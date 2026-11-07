import { Logo } from './ui'

export function AuthCard({
  titulo,
  subtitulo,
  children,
  pie,
}: {
  titulo: string
  subtitulo: string
  children: React.ReactNode
  pie?: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <Logo className="text-4xl" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold text-balance">{titulo}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{subtitulo}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl shadow-black/20">{children}</div>
        {pie && <div className="text-center text-sm text-muted-foreground">{pie}</div>}
      </div>
    </main>
  )
}
