'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import {
  borrarEstado,
  getEstados,
  mensajeDeError,
  subirArchivo,
  subirEstado,
  urlArchivo,
  type EstadosDeUsuario,
  type Usuario,
} from '@/lib/api'
import { horaMensaje } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { ElegirServidorFlyer, TarjetaFlyer } from './flyer'
import { Modal } from './modal'
import { useToast } from './toast-provider'
import { Avatar, Boton, ErrorFormulario } from './ui'

const DURACION_MS = 5000
const COLORES = ['#ff6b5b', '#3d9be8', '#3fb68b', '#e8a33d', '#d9667f', '#7c5cff', '#4fb3bf', '#252833']

/** Fila de estados de mis amigos (como las historias de Instagram/WhatsApp). */
export function EstadosBarra({ yo }: { yo: Usuario }) {
  const { data, mutate } = useSWR('estados', getEstados, { refreshInterval: 30000 })
  const [viendo, setViendo] = useState<number | null>(null) // índice del grupo abierto
  const [creando, setCreando] = useState(false)
  const grupos = data ?? []
  const mios = grupos.find((g) => g.usuario.id === yo.id)

  return (
    <section aria-label="Estados" className="flex gap-4 overflow-x-auto pb-1">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => (mios ? setViendo(grupos.indexOf(mios)) : setCreando(true))}
            className={cn('rounded-2xl p-0.5', mios && 'bg-gradient-to-tr from-primary to-warning')}
            aria-label={mios ? 'Ver mis estados' : 'Subir un estado'}
          >
            <span className="block rounded-[14px] bg-background p-0.5">
              <Avatar nombre={yo.username} url={yo.avatar_url} tamanio="lg" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
            aria-label="Subir otro estado"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <span className="text-[11px] text-muted-foreground">Tu estado</span>
      </div>

      {grupos.map((g, i) =>
        g.usuario.id === yo.id ? null : (
          <button
            key={g.usuario.id}
            type="button"
            onClick={() => setViendo(i)}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
            aria-label={`Ver estados de ${g.usuario.username}`}
          >
            <span className="rounded-2xl bg-gradient-to-tr from-primary to-warning p-0.5">
              <span className="block rounded-[14px] bg-background p-0.5">
                <Avatar nombre={g.usuario.username} url={g.usuario.avatar_url} tamanio="lg" />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px]">{g.usuario.username}</span>
          </button>
        ),
      )}

      {grupos.length === 0 && (
        <p className="self-center text-sm text-muted-foreground">Cuando alguien suba un estado lo vas a ver acá.</p>
      )}

      {viendo !== null && grupos[viendo] && (
        <VisorEstados
          grupos={grupos}
          inicial={viendo}
          miId={yo.id}
          onCerrar={() => setViendo(null)}
          onBorrado={() => mutate()}
        />
      )}
      <CrearEstadoModal abierto={creando} yo={yo} onCerrar={() => setCreando(false)} onCreado={() => mutate()} />
    </section>
  )
}

/** Visor a pantalla completa: pasa solo cada 5 segundos, o con las flechas / tocando los costados. */
function VisorEstados({
  grupos,
  inicial,
  miId,
  onCerrar,
  onBorrado,
}: {
  grupos: EstadosDeUsuario[]
  inicial: number
  miId: number
  onCerrar: () => void
  onBorrado: () => void
}) {
  const toast = useToast()
  const [grupo, setGrupo] = useState(inicial)
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const transcurrido = useRef(0)

  const actual = grupos[grupo]
  const estado = actual?.estados[indice]

  function siguiente() {
    if (!actual) return
    if (indice + 1 < actual.estados.length) setIndice(indice + 1)
    else if (grupo + 1 < grupos.length) {
      setGrupo(grupo + 1)
      setIndice(0)
    } else onCerrar()
  }

  function anterior() {
    if (indice > 0) setIndice(indice - 1)
    else if (grupo > 0) {
      setGrupo(grupo - 1)
      setIndice(grupos[grupo - 1].estados.length - 1)
    }
  }

  // Reinicia la barrita al cambiar de estado (este efecto corre antes que el del temporizador).
  useEffect(() => {
    transcurrido.current = 0
    setProgreso(0)
  }, [grupo, indice])

  // Avanza la barrita; al pausar (mantener apretado) se guarda cuánto pasó.
  useEffect(() => {
    if (pausado) return
    const comienzo = Date.now() - transcurrido.current
    const id = window.setInterval(() => {
      transcurrido.current = Date.now() - comienzo
      const p = transcurrido.current / DURACION_MS
      if (p >= 1) {
        window.clearInterval(id)
        siguiente()
      } else setProgreso(p)
    }, 50)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausado, grupo, indice])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') siguiente()
      if (e.key === 'ArrowLeft') anterior()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  if (!actual || !estado) return null

  async function borrar() {
    if (!estado) return
    try {
      await borrarEstado(estado.id)
      onBorrado()
      onCerrar()
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Estados de ${actual.usuario.username}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div
        className="relative flex h-full max-h-[min(100dvh,52rem)] w-full max-w-md flex-col overflow-hidden sm:rounded-2xl"
        style={{ backgroundColor: estado.imagen_url ? '#000' : estado.color_fondo }}
        onPointerDown={() => setPausado(true)}
        onPointerUp={() => setPausado(false)}
        onPointerLeave={() => setPausado(false)}
      >
        <div className="absolute inset-x-0 top-0 z-10 flex flex-col gap-3 bg-gradient-to-b from-black/60 to-transparent p-3">
          <div className="flex gap-1">
            {actual.estados.map((e, i) => (
              <span key={e.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                <span
                  className="block h-full bg-white"
                  style={{ width: `${i < indice ? 100 : i === indice ? progreso * 100 : 0}%` }}
                />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white">
            <Avatar nombre={actual.usuario.username} url={actual.usuario.avatar_url} tamanio="sm" />
            <span className="text-sm font-semibold">{actual.usuario.username}</span>
            <span className="text-xs text-white/70">{horaMensaje(estado.fecha)}</span>
            <span className="ml-auto flex gap-1">
              {actual.usuario.id === miId && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={borrar}
                  className="rounded-full p-1.5 hover:bg-white/15"
                  aria-label="Borrar este estado"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onCerrar}
                className="rounded-full p-1.5 hover:bg-white/15"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          {estado.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlArchivo(estado.imagen_url)} alt="" className="max-h-full max-w-full object-contain" />
          ) : null}
        </div>
        {estado.flyer && (
          <div className="absolute inset-x-4 bottom-24 z-20">
            <TarjetaFlyer flyer={estado.flyer} oscura />
          </div>
        )}
        {estado.contenido && (
          <p
            className={cn(
              'absolute inset-x-0 px-8 text-center font-semibold text-white text-balance',
              estado.imagen_url
                ? 'bottom-10 bg-black/50 py-3 text-base'
                : 'top-1/2 -translate-y-1/2 text-2xl leading-snug drop-shadow',
            )}
          >
            {estado.contenido}
          </p>
        )}

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={anterior}
          className="absolute inset-y-0 left-0 w-1/4"
          aria-label="Estado anterior"
        >
          <ChevronLeft className="ml-2 size-6 text-white/60" aria-hidden />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={siguiente}
          className="absolute inset-y-0 right-0 flex w-1/4 items-center justify-end"
          aria-label="Estado siguiente"
        >
          <ChevronRight className="mr-2 size-6 text-white/60" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function CrearEstadoModal({
  abierto,
  yo,
  onCerrar,
  onCreado,
}: {
  abierto: boolean
  yo: Usuario
  onCerrar: () => void
  onCreado: () => void
}) {
  const [promocionar, setPromocionar] = useState<number | null>(null)
  const toast = useToast()
  const [texto, setTexto] = useState('')
  const [color, setColor] = useState(COLORES[0])
  const [imagen, setImagen] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  function cerrar() {
    setTexto('')
    setImagen(null)
    setPromocionar(null)
    setError(null)
    onCerrar()
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await subirEstado({ contenido: texto.trim(), imagen_url: imagen, color_fondo: color, promocionar_servidor_id: promocionar })
      toast.exito('Subiste un estado. Lo ve todo Kort durante 24 horas.')
      onCreado()
      cerrar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Subir un estado" descripcion="Es público: lo ve todo Kort durante 24 horas.">
      <form onSubmit={publicar} className="flex flex-col gap-4">
        <div
          className="relative flex aspect-[4/5] max-h-80 items-center justify-center overflow-hidden rounded-2xl p-6"
          style={{ backgroundColor: imagen ? '#000' : color }}
        >
          {imagen && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlArchivo(imagen)} alt="" className="absolute inset-0 size-full object-contain" />
          )}
          <textarea
            aria-label="Texto del estado"
            value={texto}
            maxLength={200}
            rows={3}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí algo…"
            className={cn(
              'relative w-full resize-none bg-transparent text-center font-semibold text-white outline-none placeholder:text-white/60',
              imagen ? 'mt-auto rounded-lg bg-black/50 p-2 text-sm' : 'text-xl',
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!imagen &&
            COLORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn('size-7 rounded-full ring-offset-2 ring-offset-surface', color === c && 'ring-2 ring-foreground')}
                style={{ backgroundColor: c }}
                aria-label={`Fondo ${c}`}
                aria-pressed={color === c}
              />
            ))}
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={async (e) => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (!archivo) return
              setSubiendo(true)
              try {
                const subido = await subirArchivo(archivo)
                if (subido.tipo !== 'imagen') throw new Error('Elegí una imagen.')
                setImagen(subido.url)
              } catch (err) {
                setError(mensajeDeError(err))
              } finally {
                setSubiendo(false)
              }
            }}
          />
          <button
            type="button"
            onClick={() => (imagen ? setImagen(null) : input.current?.click())}
            disabled={subiendo}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground"
          >
            {imagen ? <X className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
            {imagen ? 'Quitar imagen' : subiendo ? 'Subiendo…' : 'Usar una imagen'}
          </button>
        </div>

        <ElegirServidorFlyer yo={yo} valor={promocionar} onCambiar={setPromocionar} />
        <ErrorFormulario mensaje={error} />
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={cargando} disabled={!texto.trim() && !imagen && !promocionar}>
            Publicar estado
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
