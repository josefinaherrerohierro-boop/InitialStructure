import { Volume2 } from 'lucide-react'

export function VoicePanel({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Volume2 className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold">{nombre}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Canal de voz. Las llamadas todavía no están disponibles en Kort.
          </p>
        </div>
      </div>
    </div>
  )
}
