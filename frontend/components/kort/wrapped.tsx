'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, Copy, Sparkles, X } from 'lucide-react'
import { getWrapped, mensajeDeError, type Wrapped } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useToast } from './toast-provider'
import { Avatar, Boton } from './ui'

const DURACION_MS = 6500
const MESES_CORTOS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const FONDOS = [
  'from-[#ff6b5b] via-[#d9667f] to-[#7c5cff]',
  'from-[#1d976c] to-[#3d9be8]',
  'from-[#7c5cff] to-[#15161c]',
  'from-[#e8a33d] via-[#ff6b5b] to-[#d9667f]',
  'from-[#3d9be8] to-[#7c5cff]',
  'from-[#d9667f] to-[#e8a33d]',
  'from-[#4fb3bf] to-[#1d976c]',
  'from-[#15161c] via-[#7c5cff] to-[#ff6b5b]',
]

const n = (x: number) => x.toLocaleString('es-AR')
/** "1 mensaje", "2 mensajes"... */
const plural = (x: number, uno: string, varios: string) => `${n(x)} ${x === 1 ? uno : varios}`

/** Número que "sube" desde 0 (animación de las placas). */
function NumeroAnimado({ valor }: { valor: number }) {
  const [actual, setActual] = useState(0)
  useEffect(() => {
    const inicio = performance.now()
    let id = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / 1200)
      setActual(Math.round(valor * (1 - (1 - p) ** 3)))
      if (p < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [valor])
  return <>{n(actual)}</>
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="text-lg font-medium text-white/80">{children}</p>
}

function Grande({ children }: { children: React.ReactNode }) {
  return <p className="text-6xl font-black tracking-tight text-white sm:text-7xl">{children}</p>
}

/** Arma las placas que tienen algo para mostrar (las vacías se saltean). */
function armarPlacas(w: Wrapped): { clave: string; contenido: React.ReactNode }[] {
  const placas: { clave: string; contenido: React.ReactNode }[] = []
  const maxMes = Math.max(1, ...w.mensajes_por_mes)

  placas.push({
    clave: 'intro',
    contenido: (
      <>
        <Sparkles className="size-10 text-white" aria-hidden />
        <Titulo>Hola, {w.username}</Titulo>
        <p className="text-5xl font-black leading-tight text-white text-balance">Tu {w.anio} en Kort</p>
        <p className="text-white/70">Repasemos lo que pasó en tus chats este año.</p>
      </>
    ),
  })

  if (w.total_mensajes > 0) {
    placas.push({
      clave: 'mensajes',
      contenido: (
        <>
          <Titulo>Este año mandaste</Titulo>
          <Grande>
            <NumeroAnimado valor={w.total_mensajes} />
          </Grande>
          <Titulo>{w.total_mensajes === 1 ? 'mensaje' : 'mensajes'} en tus servidores</Titulo>
          <p className="text-white/80">
            {w.total_palabras === 1 ? 'Es 1 palabra' : `Son ${n(w.total_palabras)} palabras`}: más o menos{' '}
            {plural(Math.max(1, Math.round(w.total_palabras / 250)), 'página', 'páginas')} de un libro.
            {w.total_mensajes_directos > 0 &&
              ` Y ${plural(w.total_mensajes_directos, 'mensaje directo', 'mensajes directos')} más.`}
          </p>
        </>
      ),
    })

    placas.push({
      clave: 'cuando',
      contenido: (
        <>
          <Titulo>Tu momento</Titulo>
          {w.hora_pico !== null && (
            <p className="text-4xl font-black text-white">
              a las {String(w.hora_pico).padStart(2, '0')}:00 hs
            </p>
          )}
          <p className="text-white/80">
            {w.dia_favorito && <>Tu día favorito para escribir: <strong className="text-white">los {w.dia_favorito}</strong>. </>}
            {w.mes_mas_activo && <>Y el mes que más hablaste fue <strong className="text-white">{w.mes_mas_activo}</strong>.</>}
          </p>
          <div className="flex h-32 w-full max-w-xs items-end gap-1.5" aria-label="Mensajes por mes">
            {w.mensajes_por_mes.map((c, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-white/85" style={{ height: `${Math.max(3, (c / maxMes) * 100)}px` }} title={`${c}`} />
                <span className="text-[10px] text-white/70">{MESES_CORTOS[i]}</span>
              </div>
            ))}
          </div>
        </>
      ),
    })

    placas.push({
      clave: 'racha',
      contenido: (
        <>
          <Titulo>Tu racha más larga</Titulo>
          <Grande>
            <NumeroAnimado valor={w.racha_mas_larga} /> 🔥
          </Grande>
          <Titulo>{w.racha_mas_larga === 1 ? 'día' : 'días seguidos'} escribiendo</Titulo>
          <p className="text-white/80">En total estuviste activo {plural(w.dias_activos, 'día', 'días')} del año.</p>
        </>
      ),
    })
  }

  if (w.canal_favorito) {
    placas.push({
      clave: 'lugar',
      contenido: (
        <>
          <Titulo>Tu lugar en el mundo</Titulo>
          <p className="text-5xl font-black text-white">#{w.canal_favorito.canal}</p>
          <p className="text-white/80">
            en {w.canal_favorito.servidor}, con {plural(w.canal_favorito.cantidad, 'mensaje tuyo', 'mensajes tuyos')}.
          </p>
          {w.servidores_mas_activos.length > 1 && (
            <ol className="flex w-full max-w-xs flex-col gap-2 text-left">
              {w.servidores_mas_activos.map((s, i) => (
                <li key={s.nombre} className="flex items-center gap-3 rounded-xl bg-white/15 px-3 py-2 text-white">
                  <span className="text-xl font-black">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.nombre}</span>
                  <span className="text-sm text-white/80">{n(s.cantidad)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ),
    })
  }

  if (w.emojis_favoritos.length > 0 || w.reacciones_recibidas > 0) {
    placas.push({
      clave: 'emojis',
      contenido: (
        <>
          <Titulo>Tus emojis del año</Titulo>
          {w.emojis_favoritos.length > 0 && (
            <div className="flex items-end gap-3">
              {w.emojis_favoritos.slice(0, 3).map((e, i) => (
                <span key={e.nombre} className={cn('flex flex-col items-center', i === 0 ? 'text-7xl' : 'text-5xl')}>
                  {e.nombre}
                  <span className="text-sm font-semibold text-white/80">{n(e.cantidad)}</span>
                </span>
              ))}
            </div>
          )}
          {w.reacciones_recibidas > 0 && (
            <p className="text-white/80">
              Y tus mensajes recibieron <strong className="text-white">{plural(w.reacciones_recibidas, 'reacción', 'reacciones')}</strong>.
            </p>
          )}
        </>
      ),
    })
  }

  if (w.persona_favorita || w.amigos_nuevos > 0) {
    placas.push({
      clave: 'gente',
      contenido: (
        <>
          <Titulo>Tu gente</Titulo>
          {w.persona_favorita && (
            <>
              <Avatar nombre={w.persona_favorita.usuario.username} url={w.persona_favorita.usuario.avatar_url} tamanio="xl" className="ring-4 ring-white/40" />
              <p className="text-4xl font-black text-white">{w.persona_favorita.usuario.username}</p>
              <p className="text-white/80">
                fue con quien más hablaste por privado: {plural(w.persona_favorita.cantidad, 'mensaje', 'mensajes')}.
              </p>
            </>
          )}
          {w.amigos_nuevos > 0 && (
            <p className="text-white/80">
              Sumaste <strong className="text-white">{n(w.amigos_nuevos)}</strong> {w.amigos_nuevos === 1 ? 'amigo nuevo' : 'amigos nuevos'}.
            </p>
          )}
        </>
      ),
    })
  }

  const extras = [
    { valor: w.servidores_nuevos, texto: 'servidores nuevos' },
    { valor: w.publicaciones, texto: 'publicaciones' },
    { valor: w.likes_recibidos, texto: 'me gusta recibidos' },
    { valor: w.tareas_completadas, texto: 'tareas completadas' },
    { valor: w.eventos_asistidos, texto: 'eventos' },
    { valor: w.puntos_ganados, texto: 'puntos en scoreboards' },
  ].filter((e) => e.valor > 0)
  if (extras.length > 0) {
    placas.push({
      clave: 'extras',
      contenido: (
        <>
          <Titulo>Y además…</Titulo>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            {extras.map((e) => (
              <div key={e.texto} className="rounded-2xl bg-white/15 p-4 text-left">
                <p className="text-3xl font-black text-white">
                  <NumeroAnimado valor={e.valor} />
                </p>
                <p className="text-sm text-white/80">{e.texto}</p>
              </div>
            ))}
          </div>
        </>
      ),
    })
  }

  placas.push({
    clave: 'personalidad',
    contenido: (
      <>
        <Titulo>Tu personalidad Kort {w.anio}</Titulo>
        <p className="text-8xl" aria-hidden>
          {w.personalidad.emoji}
        </p>
        <p className="text-5xl font-black text-white text-balance">{w.personalidad.titulo}</p>
        <p className="text-white/80">{w.personalidad.descripcion}</p>
      </>
    ),
  })

  return placas
}

/** El Wrapped a pantalla completa, con placas que pasan solas (como historias). */
export function WrappedHistoria({ anio, onCerrar }: { anio: number; onCerrar: () => void }) {
  const toast = useToast()
  const { data, error } = useSWR(['wrapped', anio], () => getWrapped(anio))
  const [indice, setIndice] = useState(0)
  const [progreso, setProgreso] = useState(0)
  const [pausado, setPausado] = useState(false)
  const transcurrido = useRef(0)

  const placas = data ? armarPlacas(data) : []
  const total = placas.length

  function siguiente() {
    setIndice((i) => Math.min(i + 1, Math.max(total - 1, 0)))
  }
  function anterior() {
    setIndice((i) => Math.max(i - 1, 0))
  }

  useEffect(() => {
    transcurrido.current = 0
    setProgreso(0)
  }, [indice])

  useEffect(() => {
    if (pausado || total === 0 || indice >= total - 1) return
    const comienzo = Date.now() - transcurrido.current
    const id = window.setInterval(() => {
      transcurrido.current = Date.now() - comienzo
      const p = transcurrido.current / DURACION_MS
      if (p >= 1) {
        window.clearInterval(id)
        setIndice((i) => i + 1)
      } else setProgreso(p)
    }, 50)
    return () => window.clearInterval(id)
  }, [pausado, indice, total])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') siguiente()
      if (e.key === 'ArrowLeft') anterior()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  async function copiarResumen() {
    if (!data) return
    const texto = [
      `Mi Kort Wrapped ${data.anio} ✨`,
      `💬 ${n(data.total_mensajes)} mensajes`,
      data.canal_favorito && `📍 Canal favorito: #${data.canal_favorito.canal}`,
      `🔥 Racha: ${data.racha_mas_larga} días`,
      data.emojis_favoritos[0] && `😀 Emoji del año: ${data.emojis_favoritos[0].nombre}`,
      `${data.personalidad.emoji} Soy "${data.personalidad.titulo}"`,
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      toast.exito('Copiamos tu resumen. ¡Pegalo donde quieras!')
    } catch {
      toast.error('No pudimos copiar el resumen.')
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Kort Wrapped ${anio}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div
        className={cn(
          'relative flex h-full max-h-[min(100dvh,52rem)] w-full max-w-md flex-col overflow-hidden bg-gradient-to-br transition-colors duration-700 sm:rounded-3xl',
          FONDOS[indice % FONDOS.length],
        )}
        onPointerDown={() => setPausado(true)}
        onPointerUp={() => setPausado(false)}
        onPointerLeave={() => setPausado(false)}
      >
        <div className="z-10 flex flex-col gap-3 p-3">
          <div className="flex gap-1">
            {placas.map((p, i) => (
              <span key={p.clave} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full bg-white" style={{ width: `${i < indice ? 100 : i === indice ? progreso * 100 : 0}%` }} />
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between text-white">
            <span className="text-sm font-semibold">kort• wrapped {anio}</span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onCerrar}
              className="rounded-full p-1.5 hover:bg-white/15"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div key={indice} className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          {error ? (
            <p className="text-white">{mensajeDeError(error)}</p>
          ) : !data ? (
            <Sparkles className="size-10 animate-pulse text-white" aria-label="Cargando" />
          ) : (
            placas[indice]?.contenido
          )}
          {data && indice === total - 1 && (
            <Boton
              onPointerDown={(e) => e.stopPropagation()}
              onClick={copiarResumen}
              className="mt-4 bg-white text-[#15161c] hover:bg-white/90"
            >
              <Copy className="size-4" aria-hidden />
              Copiar mi resumen
            </Boton>
          )}
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={anterior}
          disabled={indice === 0}
          className="absolute inset-y-16 left-0 w-1/4 disabled:cursor-default"
          aria-label="Anterior"
        >
          <ChevronLeft className="ml-2 size-6 text-white/50" aria-hidden />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={siguiente}
          disabled={indice >= total - 1}
          className="absolute inset-y-16 right-0 flex w-1/4 items-center justify-end disabled:cursor-default"
          aria-label="Siguiente"
        >
          <ChevronRight className="mr-2 size-6 text-white/50" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Pestaña "Kort Wrapped" de la configuración: elegir año y abrirlo. */
export function WrappedTab() {
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="flex flex-col items-start gap-5">
      <div className="w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff6b5b] via-[#d9667f] to-[#7c5cff] p-6 text-white">
        <Sparkles className="mb-3 size-8" aria-hidden />
        <p className="text-3xl font-black">Kort Wrapped</p>
        <p className="mt-1 text-white/85">Tu año en Kort: cuánto escribiste, tu canal favorito, tus emojis, tu gente y más.</p>
      </div>
      <label className="flex items-center gap-3 text-sm">
        Año:
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="h-10 rounded-lg border border-border bg-background px-3"
        >
          {[0, 1, 2].map((i) => (
            <option key={i} value={anioActual - i}>
              {anioActual - i}
            </option>
          ))}
        </select>
      </label>
      <Boton onClick={() => setAbierto(true)}>
        <Sparkles className="size-4" aria-hidden />
        Ver mi Wrapped {anio}
      </Boton>
      {abierto && <WrappedHistoria anio={anio} onCerrar={() => setAbierto(false)} />}
    </div>
  )
}
