'use client'

import { useEffect, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import { ArrowRight, Compass, Hourglass, Search, Users } from 'lucide-react'
import { explorarServidores, mensajeDeError, unirseAServidor, type Servidor, type ServidorPublico } from '@/lib/api'
import { cn } from '@/lib/utils'
import { tiempoRestante } from './server-selector'
import { useToast } from './toast-provider'
import { Avatar, Boton, Input } from './ui'

const POR_PAGINA = 24
type Orden = 'populares' | 'nuevos'

function TarjetaServidor({
  s,
  onUnido,
  onIr,
}: {
  s: ServidorPublico
  onUnido: (servidor: Servidor) => void
  onIr: (id: number) => void
}) {
  const toast = useToast()
  const [uniendo, setUniendo] = useState(false)

  async function unirme() {
    setUniendo(true)
    try {
      const servidor = await unirseAServidor(s.id)
      toast.exito(`¡Te uniste a "${servidor.nombre}"!`)
      onUnido(servidor)
    } catch (err) {
      toast.error(mensajeDeError(err))
      setUniendo(false)
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-border bg-background/60 p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <Avatar nombre={s.nombre} url={s.icono_url} tamanio="lg" className="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold">{s.nombre}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3" aria-hidden />
              {s.miembros} {s.miembros === 1 ? 'miembro' : 'miembros'}
            </span>
            {s.expira_en && (
              <span className="flex items-center gap-1 text-primary">
                <Hourglass className="size-3" aria-hidden />
                {tiempoRestante(s.expira_en)}
              </span>
            )}
          </p>
        </div>
      </div>
      <p className={cn('line-clamp-3 min-h-[3.75rem] text-sm', s.descripcion ? 'text-foreground/90' : 'text-muted-foreground italic')}>
        {s.descripcion || 'Sin descripción.'}
      </p>
      {s.soy_miembro ? (
        <Boton variante="secundario" onClick={() => onIr(s.id)} className="self-start">
          Ir al servidor
          <ArrowRight className="size-4" aria-hidden />
        </Boton>
      ) : (
        <Boton onClick={unirme} cargando={uniendo} className="self-start">
          Unirme
        </Boton>
      )}
    </article>
  )
}

/** Buscar y explorar servidores públicos. Cualquiera puede unirse sin invitación. */
export function ExplorarView({ onUnido, onIr }: { onUnido: (s: Servidor) => void; onIr: (id: number) => void }) {
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('populares')

  // Busca solo cuando dejás de escribir un ratito.
  useEffect(() => {
    const id = window.setTimeout(() => setBusqueda(texto.trim()), 350)
    return () => window.clearTimeout(id)
  }, [texto])

  const { data, size, setSize, isLoading, mutate } = useSWRInfinite(
    (indice, anterior: ServidorPublico[] | null) => {
      if (anterior && anterior.length < POR_PAGINA) return null
      return ['explorar', busqueda, orden, indice + 1]
    },
    ([, q, o, pagina]) => explorarServidores(q as string, o as Orden, pagina as number),
  )
  const servidores = data?.flat() ?? []
  const hayMas = (data?.at(-1)?.length ?? 0) >= POR_PAGINA

  return (
    <div className="scrollbar-thin @container flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-5">
        <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Compass className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight">Explorá comunidades</h2>
              <p className="text-sm text-muted-foreground">Servidores públicos: entrás con un clic, sin invitación.</p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Buscar servidores"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscá por nombre o descripción: ajedrez, programación, música…"
              className="h-12 rounded-full bg-surface pl-11"
            />
          </div>
          <div role="tablist" className="flex gap-1.5">
            {(
              [
                ['populares', 'Más populares'],
                ['nuevos', 'Más nuevos'],
              ] as const
            ).map(([id, nombre]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={orden === id}
                onClick={() => setOrden(id)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  orden === id ? 'border-foreground bg-foreground font-semibold text-background' : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                )}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>

        {isLoading && servidores.length === 0 ? (
          <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-3xl bg-elevated" />
            ))}
          </div>
        ) : servidores.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Compass className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">{busqueda ? `No encontramos servidores públicos con “${busqueda}”.` : 'Todavía no hay servidores públicos.'}</p>
            <p className="text-sm text-muted-foreground">Podés crear uno y marcarlo como público para que otros lo encuentren.</p>
          </div>
        ) : (
          <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {servidores.map((s) => (
              <TarjetaServidor
                key={s.id}
                s={s}
                onIr={onIr}
                onUnido={(servidor) => {
                  mutate()
                  onUnido(servidor)
                }}
              />
            ))}
          </div>
        )}
        {hayMas && (
          <Boton variante="secundario" className="self-center" onClick={() => setSize(size + 1)}>
            Ver más
          </Boton>
        )}
      </div>
    </div>
  )
}
