'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { ImagePlus, Plus, Star, Trash2, X } from 'lucide-react'
import {
  actualizarPerfil,
  agregarFotoPerfil,
  borrarFotoPerfil,
  elegirFotoPrincipal,
  getPerfil,
  mensajeDeError,
  subirArchivo,
  urlArchivo,
  type Perfil,
  type RedSocial,
  type Usuario,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { Seccion } from '../config/confirmar'
import { REDES } from '../perfil-modal'
import { useToast } from '../toast-provider'
import { Boton, Campo, ErrorFormulario, Input } from '../ui'

const MAX_FOTOS = 6

function Fotos({ perfil, onCambio }: { perfil: Perfil; onCambio: (p: Perfil) => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  async function hacer(accion: () => Promise<Perfil>) {
    try {
      onCambio(await accion())
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  return (
    <Seccion
      titulo="Fotos de perfil"
      descripcion={`Podés tener hasta ${MAX_FOTOS}. La marcada con la estrella es tu foto principal: es la que ve todo el mundo en el chat. Las demás se ven en tu perfil.`}
    >
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
            if (subido.tipo !== 'imagen') throw new Error('Elegí una imagen (PNG, JPG, GIF o WEBP).')
            onCambio(await agregarFotoPerfil(subido.url))
          } catch (err) {
            toast.error(mensajeDeError(err))
          } finally {
            setSubiendo(false)
          }
        }}
      />
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {perfil.fotos.map((f) => (
          <li key={f.id} className="group relative aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlArchivo(f.url)}
              alt=""
              className={cn('size-full rounded-xl object-cover', f.principal && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}
            />
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => hacer(() => elegirFotoPrincipal(f.id))}
                disabled={f.principal}
                className="rounded-md bg-black/70 p-1 text-white disabled:text-warning"
                aria-label={f.principal ? 'Es tu foto principal' : 'Usar como foto principal'}
                title={f.principal ? 'Foto principal' : 'Usar como principal'}
              >
                <Star className={cn('size-3.5', f.principal && 'fill-current')} />
              </button>
              <button
                type="button"
                onClick={() => hacer(() => borrarFotoPerfil(f.id))}
                className="rounded-md bg-black/70 p-1 text-white hover:text-destructive"
                aria-label="Borrar foto"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
        {perfil.fotos.length < MAX_FOTOS && (
          <li className="aspect-square">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={subiendo}
              className="flex size-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              <ImagePlus className={cn('size-5', subiendo && 'animate-pulse')} aria-hidden />
              {subiendo ? 'Subiendo…' : 'Agregar'}
            </button>
          </li>
        )}
      </ul>
    </Seccion>
  )
}

function FormularioPerfil({ perfil, onCambio }: { perfil: Perfil; onCambio: (p: Perfil) => void }) {
  const toast = useToast()
  const [bio, setBio] = useState(perfil.bio ?? '')
  const [etiquetas, setEtiquetas] = useState(perfil.etiquetas)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [redes, setRedes] = useState<RedSocial[]>(perfil.redes)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function agregarEtiqueta() {
    const e = nuevaEtiqueta.trim()
    if (!e) return
    if (!etiquetas.some((x) => x.toLowerCase() === e.toLowerCase())) setEtiquetas((prev) => [...prev, e].slice(0, 10))
    setNuevaEtiqueta('')
  }

  const disponibles = Object.keys(REDES).filter((r) => !redes.some((x) => x.red === r))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const conUrl = redes.filter((r) => r.url.trim())
    if (conUrl.some((r) => !/^https?:\/\/\S+$/.test(r.url.trim()))) {
      setError('Los links de las redes tienen que empezar con https://')
      return
    }
    setGuardando(true)
    try {
      onCambio(await actualizarPerfil({ bio, etiquetas, redes: conUrl.map((r) => ({ red: r.red, url: r.url.trim() })) }))
      toast.exito('Guardamos tu perfil.')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      <Seccion titulo="Sobre mí">
        <Campo id="perfil-bio" etiqueta="Biografía" ayuda={`${bio.length}/190 caracteres`}>
          <textarea
            id="perfil-bio"
            value={bio}
            maxLength={190}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Contá algo sobre vos"
            className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Etiquetas" descripcion="Hasta 10: tus gustos, lo que jugás, lo que estudiás…">
        <ul className="flex flex-wrap gap-1.5">
          {etiquetas.map((e) => (
            <li key={e} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary">
              {e}
              <button
                type="button"
                onClick={() => setEtiquetas((prev) => prev.filter((x) => x !== e))}
                className="rounded-full p-0.5 hover:bg-primary/20"
                aria-label={`Quitar ${e}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        {etiquetas.length < 10 && (
          <div className="flex gap-2">
            <Input
              aria-label="Nueva etiqueta"
              value={nuevaEtiqueta}
              maxLength={24}
              onChange={(e) => setNuevaEtiqueta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  agregarEtiqueta()
                }
              }}
              placeholder="Ej.: Gamer, Música, Programación"
              className="h-10"
            />
            <Boton type="button" variante="secundario" onClick={agregarEtiqueta} className="h-10">
              <Plus className="size-4" aria-hidden />
              Agregar
            </Boton>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Redes sociales" descripcion="Aparecen en tu perfil como links.">
        {redes.map((r, i) => {
          const info = REDES[r.red]
          return (
            <div key={r.red} className="flex items-center gap-2">
              <span className="flex w-28 shrink-0 items-center gap-1.5 text-sm">
                <info.Icono className="size-4" style={{ color: info.color }} aria-hidden />
                {info.nombre}
              </span>
              <Input
                aria-label={`Link de ${info.nombre}`}
                value={r.url}
                maxLength={255}
                onChange={(e) => setRedes((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://…"
                className="h-10"
              />
              <button
                type="button"
                onClick={() => setRedes((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-lg p-2 text-muted-foreground hover:bg-elevated hover:text-destructive"
                aria-label={`Quitar ${info.nombre}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )
        })}
        {disponibles.length > 0 && (
          <select
            aria-label="Agregar red social"
            value=""
            onChange={(e) => e.target.value && setRedes((prev) => [...prev, { red: e.target.value, url: 'https://' }])}
            className="h-10 w-fit rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">+ Agregar red social</option>
            {disponibles.map((r) => (
              <option key={r} value={r}>
                {REDES[r].nombre}
              </option>
            ))}
          </select>
        )}
      </Seccion>

      <ErrorFormulario mensaje={error} />
      <div className="flex justify-end">
        <Boton type="submit" cargando={guardando}>
          Guardar perfil
        </Boton>
      </div>
    </form>
  )
}

export function PerfilTab({ usuario, onActualizado }: { usuario: Usuario; onActualizado: () => void }) {
  const { data: perfil, mutate } = useSWR(['perfil', usuario.id], () => getPerfil(usuario.id))
  if (!perfil) return <div className="h-64 animate-pulse rounded-xl bg-surface" aria-hidden />

  function alCambiar(p: Perfil) {
    mutate(p, { revalidate: false })
    onActualizado()
  }

  return (
    <div className="flex flex-col gap-6">
      <Fotos perfil={perfil} onCambio={alCambiar} />
      <FormularioPerfil key={perfil.id} perfil={perfil} onCambio={alCambiar} />
    </div>
  )
}
