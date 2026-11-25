import { Logo, LogoMarca } from './ui'

/** Vista previa decorativa del chat de Kort (burbujas), para el panel de bienvenida. */
function VistaPrevia() {
  return (
    <div aria-hidden className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-end gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-xs font-bold text-white">AN</span>
        <span className="rounded-2xl rounded-bl-md bg-white/90 px-3.5 py-2 text-sm text-[#231c15] shadow-lg">
          ¿Hacemos la juntada el sábado? 🎉
        </span>
      </div>
      <div className="ml-10 flex w-fit gap-1.5">
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs text-white">🔥 4</span>
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs text-white">👍 2</span>
      </div>
      <span className="self-end rounded-2xl rounded-br-md bg-[#231c15] px-3.5 py-2 text-sm text-white shadow-lg">
        ¡Dale! Armo la encuesta 📊
      </span>
      <div className="ml-10 w-56 rounded-2xl bg-white/90 p-3 text-xs text-[#231c15] shadow-lg">
        <p className="mb-2 font-semibold">¿Qué día?</p>
        <div className="mb-1.5 h-6 overflow-hidden rounded-md bg-[#efe8dc]">
          <div className="flex h-full w-2/3 items-center whitespace-nowrap rounded-md bg-[#e2553d]/25 px-2">Sábado · 67%</div>
        </div>
        <div className="h-6 overflow-hidden rounded-md bg-[#efe8dc]">
          <div className="flex h-full w-1/3 items-center whitespace-nowrap rounded-md bg-[#e2553d]/10 px-2">Viernes · 33%</div>
        </div>
      </div>
    </div>
  )
}

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
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca (solo en pantallas grandes) */}
      <section className="relative m-3 hidden flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#e2553d] via-[#d2493f] to-[#9c3a4a] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10" aria-hidden />
        <div className="relative flex items-center gap-2.5">
          <span className="rounded-xl bg-white p-1">
            <LogoMarca className="size-7" />
          </span>
          <span className="font-display text-2xl font-extrabold tracking-tight">kort</span>
        </div>
        <div className="relative flex flex-col gap-8">
          <h2 className="max-w-md font-display text-5xl leading-[1.05] font-extrabold tracking-tight text-balance">
            Tu grupo, en un solo lugar.
          </h2>
          <VistaPrevia />
        </div>
        <p className="relative text-sm text-white/80">Chats, llamadas, calendario, tareas y juegos para tu comunidad.</p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-5">
            <Logo className="text-3xl lg:hidden" />
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-balance">{titulo}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{subtitulo}</p>
            </div>
          </div>
          <div className="panel p-6">{children}</div>
          {pie && <div className="text-sm text-muted-foreground">{pie}</div>}
        </div>
      </section>
    </main>
  )
}
