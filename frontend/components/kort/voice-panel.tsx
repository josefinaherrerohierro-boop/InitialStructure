'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  Gamepad2,
  Headphones,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  MonitorUp,
  PenTool,
  PhoneOff,
  Users,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react'
import { getParticipantesDirecto, getParticipantesVoz, type ParticipanteVoz, type Usuario } from '@/lib/api'
import { mismaSala, type SalaVoz, type Voz } from '@/lib/use-voz'
import { cn } from '@/lib/utils'
import { JuegosLlamada } from './juegos-llamada'
import { Pizarra } from './pizarra'
import { Avatar, Boton, ErrorFormulario } from './ui'

/** Un <video> que muestra un MediaStream (de la cámara o la pantalla). */
function VideoStream({ stream, espejo, className }: { stream: MediaStream; espejo?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted // el audio viaja aparte (ver use-voz)
      className={cn('size-full bg-black object-cover', espejo && '-scale-x-100', className)}
    />
  )
}

type Tarjeta = {
  clave: string
  participante: ParticipanteVoz
  esYo: boolean
  tipo: 'camara' | 'pantalla' | 'avatar'
  stream?: MediaStream
}

type Pestania = 'llamada' | 'pizarra' | 'juegos'

/** Pantalla de un canal de voz: entrar, ver/escuchar, cámara, pantalla, pizarra y juegos. */
export function VoicePanel({
  canal,
  yo,
  voz,
  ampliada = false,
  onAmpliar,
}: {
  /** Un canal de voz o, con directo: true, un mensaje directo (id = la otra persona). */
  canal: SalaVoz
  yo: Usuario
  voz: Voz
  /** Ampliada = se ocultan los paneles de los costados para que la llamada ocupe todo. */
  ampliada?: boolean
  onAmpliar?: (v: boolean) => void
}) {
  const [pestania, setPestania] = useState<Pestania>('llamada')
  const [destacado, setDestacado] = useState<string | null>(null)
  const enEsteCanal = mismaSala(voz.canal, canal)
  const conectado = enEsteCanal && voz.estado === 'conectado'

  // Mientras no estoy adentro, muestro quiénes están conectados (se actualiza cada 3 s).
  const { data: presentes } = useSWR(
    !conectado ? ['voz', canal.directo ? 'directo' : 'canal', canal.id] : null,
    () => (canal.directo ? getParticipantesDirecto(canal.id) : getParticipantesVoz(canal.id)),
    {
    refreshInterval: 3000,
    onError: () => {},
    },
  )

  if (conectado) {
    const yoComoParticipante: ParticipanteVoz = {
      usuario_id: yo.id,
      username: yo.username,
      silenciado: voz.silenciado,
      camara: !!voz.camaraLocal,
      pantalla: !!voz.pantallaLocal,
    }
    // Cada persona tiene una tarjeta (con cámara o con su avatar) y, si
    // comparte pantalla, otra tarjeta más para la pantalla.
    const tarjetas: Tarjeta[] = []
    for (const p of [yoComoParticipante, ...voz.participantes]) {
      const esYo = p.usuario_id === yo.id
      const camara = esYo ? voz.camaraLocal : voz.videos[p.usuario_id]?.camara
      const pantalla = esYo ? voz.pantallaLocal : voz.videos[p.usuario_id]?.pantalla
      if (p.pantalla && pantalla) tarjetas.push({ clave: `${p.usuario_id}-pantalla`, participante: p, esYo, tipo: 'pantalla', stream: pantalla })
      tarjetas.push(
        p.camara && camara
          ? { clave: `${p.usuario_id}-camara`, participante: p, esYo, tipo: 'camara', stream: camara }
          : { clave: `${p.usuario_id}-avatar`, participante: p, esYo, tipo: 'avatar' },
      )
    }
    const principal = tarjetas.find((t) => t.clave === destacado) ?? tarjetas.find((t) => t.tipo === 'pantalla')
    const resto = principal ? tarjetas.filter((t) => t !== principal) : tarjetas

    const renderTarjeta = (t: Tarjeta, grande = false, lateral = false) => {
      const habla = !t.participante.silenciado && voz.hablando[t.participante.usuario_id]
      return (
        <button
          key={t.clave}
          type="button"
          onClick={() => setDestacado(destacado === t.clave ? null : t.clave)}
          className={cn(
            'relative flex items-center justify-center overflow-hidden rounded-2xl border bg-surface transition-all',
            // La grande ocupa todo el espacio libre; las del costado son chicas.
            grande ? 'size-full min-h-48 bg-black' : lateral ? 'aspect-video w-48 shrink-0 @3xl:w-full' : 'aspect-video w-full sm:w-64',
            habla && t.tipo !== 'pantalla' ? 'border-success ring-2 ring-success/40' : 'border-border',
          )}
          aria-label={`${t.participante.username}${t.tipo === 'pantalla' ? ' (pantalla)' : ''}. Tocá para ${destacado === t.clave ? 'achicar' : 'agrandar'}`}
        >
          {t.stream ? (
            <VideoStream
              stream={t.stream}
              espejo={t.esYo && t.tipo === 'camara'}
              // object-contain: la imagen entera, sin deformarse ni recortarse (bandas negras si hace falta).
              // absolute inset-0: el video ocupa justo su recuadro, sin importar lo grande que sea la pantalla original.
              className={cn((t.tipo === 'pantalla' || grande) && 'object-contain', grande && 'absolute inset-0')}
            />
          ) : (
            <Avatar nombre={t.participante.username} tamanio={grande ? 'xl' : 'lg'} />
          )}
          <span className="absolute bottom-2 left-2 flex max-w-[90%] items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">
            {t.tipo === 'pantalla' && <MonitorUp className="size-3" aria-hidden />}
            <span className="truncate">
              {t.participante.username}
              {t.esYo && ' (vos)'}
            </span>
            {t.participante.silenciado && t.tipo !== 'pantalla' && <MicOff className="size-3 text-destructive" aria-label="Silenciado" />}
          </span>
        </button>
      )
    }

    const botonControl = (activo: boolean, peligro = false) =>
      cn(
        'flex size-11 items-center justify-center rounded-full transition-colors',
        peligro
          ? 'bg-destructive text-white hover:bg-destructive/85'
          : activo
            ? 'bg-foreground text-background'
            : 'bg-elevated text-foreground hover:bg-border',
      )

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div role="tablist" className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-2">
          {(
            [
              ['llamada', 'Llamada', Users],
              ['pizarra', 'Pizarra', PenTool],
              ['juegos', 'Juegos', Gamepad2],
            ] as const
          ).map(([id, etiqueta, Icono]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestania === id}
              onClick={() => setPestania(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                pestania === id ? 'bg-elevated font-medium text-foreground' : 'text-muted-foreground hover:bg-elevated/60',
              )}
            >
              <Icono className="size-4" aria-hidden />
              {etiqueta}
              {id === 'juegos' && voz.juego && voz.juego.estado !== 'terminado' && (
                <span className="size-2 rounded-full bg-primary" aria-label="Hay un juego en curso" />
              )}
            </button>
          ))}
          {onAmpliar && (
            <button
              type="button"
              onClick={() => onAmpliar(!ampliada)}
              aria-pressed={ampliada}
              title={ampliada ? 'Volver a ver los paneles' : 'Ocultar los paneles para que la llamada ocupe todo'}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
            >
              {ampliada ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
              <span className="hidden sm:inline">{ampliada ? 'Achicar' : 'Ampliar'}</span>
            </button>
          )}
        </div>

        <div key={pestania} className="aparecer flex min-h-0 flex-1 flex-col">
        {pestania === 'llamada' &&
          (principal ? (
            // Algo destacado (por ejemplo, una pantalla compartida): ocupa casi todo y
            // las cámaras van en una columna al costado (o en una fila abajo si es angosto).
            <div className="@container flex min-h-0 flex-1">
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 @3xl:flex-row">
                <div className="flex min-h-0 min-w-0 flex-1">{renderTarjeta(principal, true)}</div>
                {resto.length > 0 && (
                  <div className="scrollbar-thin flex shrink-0 gap-3 overflow-auto @3xl:w-56 @3xl:flex-col">
                    {resto.map((t) => renderTarjeta(t, false, true))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="scrollbar-thin flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-3 overflow-y-auto p-4">
              {resto.map((t) => renderTarjeta(t))}
            </div>
          ))}
        {pestania === 'pizarra' && <Pizarra
            trazos={voz.trazos}
            miId={yo.id}
            nombreCanal={canal.nombre}
            onTrazo={voz.dibujar}
            onDeshacer={() => voz.deshacerPizarra(yo.id)}
            onLimpiar={voz.limpiarPizarra}
          />}
        {pestania === 'juegos' && <JuegosLlamada voz={voz} miId={yo.id} />}
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-border p-4">
          {voz.participantes.length === 0 && pestania === 'llamada' && (
            <p className="text-sm text-muted-foreground">Por ahora estás solo. Cuando alguien entre, lo vas a escuchar.</p>
          )}
          <ErrorFormulario mensaje={voz.error} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={voz.alternarSilencio}
              className={botonControl(voz.silenciado)}
              aria-label={voz.silenciado ? 'Activar micrófono' : 'Silenciarme'}
              title={voz.silenciado ? 'Activar micrófono' : 'Silenciarme'}
            >
              {voz.silenciado ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
            <button
              type="button"
              onClick={voz.alternarCamara}
              className={botonControl(!!voz.camaraLocal)}
              aria-label={voz.camaraLocal ? 'Apagar cámara' : 'Prender cámara'}
              title={voz.camaraLocal ? 'Apagar cámara' : 'Prender cámara'}
            >
              {voz.camaraLocal ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </button>
            <button
              type="button"
              onClick={voz.alternarPantalla}
              className={botonControl(!!voz.pantallaLocal)}
              aria-label={voz.pantallaLocal ? 'Dejar de compartir pantalla' : 'Compartir pantalla'}
              title={voz.pantallaLocal ? 'Dejar de compartir pantalla' : 'Compartir pantalla'}
            >
              <MonitorUp className="size-5" />
            </button>
            <button type="button" onClick={voz.salir} className={botonControl(false, true)} aria-label="Salir de la llamada" title="Salir">
              <PhoneOff className="size-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const conectando = enEsteCanal && voz.estado === 'conectando'
  const enOtroCanal = voz.canal !== null && !enEsteCanal

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Volume2 className="size-7" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{canal.directo ? `Llamada con ${canal.nombre}` : canal.nombre}</h2>
          <p className="text-sm text-muted-foreground">{canal.directo ? 'Mensaje directo · voz y video' : 'Canal de voz y video'}</p>
        </div>

        {presentes && presentes.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-2">
            {presentes.map((p) => (
              <li key={p.usuario_id} className="flex items-center gap-1.5 rounded-lg bg-elevated px-2 py-1 text-xs">
                <Avatar nombre={p.username} tamanio="sm" />
                {p.username}
                {p.camara && <Video className="size-3 text-success" aria-label="Con cámara" />}
                {p.pantalla && <MonitorUp className="size-3 text-success" aria-label="Compartiendo pantalla" />}
                {p.silenciado && <MicOff className="size-3 text-destructive" aria-label="Silenciado" />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {canal.directo ? `Cuando entres, a ${canal.nombre} le va a aparecer que lo estás llamando.` : 'No hay nadie conectado todavía.'}
          </p>
        )}

        {enEsteCanal && <ErrorFormulario mensaje={voz.error} />}
        {enOtroCanal && (
          <p className="text-sm text-muted-foreground">
            Ahora estás en {voz.canal?.directo ? `la llamada con ${voz.canal.nombre}` : voz.canal?.nombre}. Si entrás acá, salís de esa llamada.
          </p>
        )}

        <Boton cargando={conectando} onClick={() => voz.entrar(canal, yo.id)}>
          <Mic className="size-4" aria-hidden />
          {canal.directo ? (presentes?.length ? 'Atender' : 'Llamar') : 'Entrar a la llamada'}
        </Boton>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Headphones className="size-3.5" aria-hidden />
          Adentro podés prender la cámara, compartir pantalla, dibujar en la pizarra y jugar.
        </p>
      </div>
    </div>
  )
}

/** Barrita fija en la barra lateral mientras estás en una llamada (aunque mires otro canal). */
export function VozBar({ voz }: { voz: Voz }) {
  if (voz.estado !== 'conectado' || !voz.canal) return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-2.5">
      <Volume2 className="size-4 shrink-0 text-success" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-success">{voz.canal.directo ? 'En llamada' : 'Conectado a la voz'}</p>
        <p className="truncate text-xs text-muted-foreground">{voz.canal.directo ? `con ${voz.canal.nombre}` : voz.canal.nombre}</p>
      </div>
      <button
        type="button"
        onClick={voz.alternarSilencio}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground"
        aria-label={voz.silenciado ? 'Activar micrófono' : 'Silenciarme'}
        title={voz.silenciado ? 'Activar micrófono' : 'Silenciarme'}
      >
        {voz.silenciado ? <MicOff className="size-4 text-destructive" /> : <Mic className="size-4" />}
      </button>
      <button
        type="button"
        onClick={voz.salir}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        aria-label="Salir del canal de voz"
        title="Salir del canal de voz"
      >
        <PhoneOff className="size-4" />
      </button>
    </div>
  )
}
