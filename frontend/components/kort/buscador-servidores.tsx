'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Globe, Hourglass, Search } from 'lucide-react'
import type { Servidor } from '@/lib/api'
import { cn } from '@/lib/utils'
import { tiempoRestante } from './server-selector'
import { Avatar } from './ui'

/** Sin tildes ni mayúsculas, para que "programacion" encuentre "Programación". */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Buscar entre los servidores de los que sos parte (botón con lupa o Ctrl+K).
 * Se filtra al instante por nombre y descripción; con ↑ ↓ y Enter se elige.
 */
export function BuscadorServidores({
  servidores,
  onSeleccionar,
  atajo = false,
}: {
  servidores: Servidor[]
  onSeleccionar: (id: number) => void
  /** Solo uno de los buscadores de la pantalla escucha Ctrl+K. */
  atajo?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [marcado, setMarcado] = useState(0)
  const dialogo = useRef<HTMLDialogElement>(null)

  const resultados = useMemo(() => {
    const q = normalizar(texto.trim())
    if (!q) return servidores
    return servidores
      .map((s) => {
        const nombre = normalizar(s.nombre)
        // Primero los que empiezan con lo buscado, después los que lo contienen.
        const puntaje = nombre.startsWith(q) ? 0 : nombre.includes(q) ? 1 : normalizar(s.descripcion ?? '').includes(q) ? 2 : -1
        return { s, puntaje }
      })
      .filter((r) => r.puntaje >= 0)
      .sort((a, b) => a.puntaje - b.puntaje)
      .map((r) => r.s)
  }, [servidores, texto])

  function abrir() {
    setTexto('')
    setMarcado(0)
    setAbierto(true)
  }

  function elegir(s: Servidor | undefined) {
    if (!s) return
    setAbierto(false)
    onSeleccionar(s.id)
  }

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  useEffect(() => {
    if (!atajo) return
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        abrir()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [atajo])

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        aria-label="Buscar en mis servidores"
        title={atajo ? 'Buscar en mis servidores (Ctrl+K)' : 'Buscar en mis servidores'}
      >
        <Search className="size-4" />
      </button>
      <dialog
        ref={dialogo}
        onClose={() => setAbierto(false)}
        onClick={(e) => e.target === dialogo.current && setAbierto(false)}
        aria-label="Buscar en mis servidores"
        className="mx-auto mt-[12vh] w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/40 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
      >
        {abierto && (
          <div className="aparecer flex max-h-[70vh] flex-col">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value)
                  setMarcado(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setMarcado((m) => Math.min(m + 1, resultados.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setMarcado((m) => Math.max(m - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    elegir(resultados[marcado])
                  }
                }}
                placeholder="Buscá entre tus servidores…"
                aria-label="Nombre del servidor"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">Esc</kbd>
            </div>
            <ul className="scrollbar-thin flex-1 overflow-y-auto p-2" role="listbox" aria-label="Resultados">
              {resultados.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {servidores.length === 0 ? 'Todavía no estás en ningún servidor.' : `Ninguno de tus servidores coincide con “${texto.trim()}”.`}
                </li>
              ) : (
                resultados.map((s, i) => (
                  <li key={s.id} role="option" aria-selected={i === marcado}>
                    <button
                      type="button"
                      onClick={() => elegir(s)}
                      onMouseMove={() => setMarcado(i)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                        i === marcado ? 'bg-elevated' : 'hover:bg-elevated/60',
                      )}
                    >
                      <Avatar nombre={s.nombre} url={s.icono_url} className="rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{s.nombre}</span>
                        <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                          {s.publico && (
                            <span className="flex items-center gap-1">
                              <Globe className="size-3" aria-hidden />
                              Público
                            </span>
                          )}
                          {s.expira_en && (
                            <span className="flex items-center gap-1 text-primary">
                              <Hourglass className="size-3" aria-hidden />
                              {tiempoRestante(s.expira_en)}
                            </span>
                          )}
                          {s.descripcion && <span className="truncate">{s.descripcion}</span>}
                        </span>
                      </span>
                      {i === marcado && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </dialog>
    </>
  )
}
