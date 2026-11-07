import { Plus, Ticket } from 'lucide-react'
import { Boton } from './ui'

export function EmptyState({ onCrear, onUnirme }: { onCrear: () => void; onUnirme: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="size-10 rotate-[-8deg] rounded-xl bg-primary/20" />
          <span className="size-14 rounded-2xl bg-primary" />
          <span className="size-10 rotate-[8deg] rounded-xl bg-success/25" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-balance">Acá va a vivir tu comunidad</h2>
          <p className="leading-relaxed text-muted-foreground text-pretty">
            Todavía no estás en ningún servidor. Armá uno propio para tu grupo o sumate a uno con el código que te
            pasaron.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Boton onClick={onCrear}>
            <Plus className="size-4" aria-hidden />
            Creá tu servidor
          </Boton>
          <Boton variante="secundario" onClick={onUnirme}>
            <Ticket className="size-4" aria-hidden />
            Unite con un código
          </Boton>
        </div>
      </div>
    </div>
  )
}
