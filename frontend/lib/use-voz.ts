'use client'

/**
 * Hook de las llamadas (WebRTC en "malla": cada participante se conecta
 * directamente con cada uno de los demás).
 *
 * Pasos:
 * 1. Pedimos el micrófono al navegador (getUserMedia).
 * 2. Abrimos el WebSocket de SEÑALIZACIÓN con nuestro backend.
 * 3. El servidor nos manda "bienvenida" con quiénes ya están. A cada uno le
 *    mandamos una OFERTA (createOffer). Ellos responden con una RESPUESTA.
 * 4. Los dos lados intercambian "candidatos ICE" (posibles caminos de red).
 * 5. Cuando se conectan, el audio y el video viajan DIRECTO entre navegadores.
 *
 * Video y pantalla compartida: cada conexión se crea desde el principio con
 * dos "lugares" para video (uno para la cámara y otro para la pantalla).
 * Prender la cámara es solo poner la imagen en su lugar (replaceTrack), así
 * no hace falta volver a negociar la conexión.
 *
 * Por el mismo WebSocket viajan también la PIZARRA y los JUEGOS.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { urlVoz, type ParticipanteVoz } from './api'

// Servidor STUN público de Google: ayuda a cada navegador a descubrir su
// dirección en internet cuando está detrás de un router.
const CONFIG_RTC: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
const UMBRAL_HABLANDO = 0.02 // volumen a partir del cual consideramos que alguien habla

export type EstadoVoz = 'desconectado' | 'conectando' | 'conectado'
export type Trazo = { puntos: [number, number][]; color: string; grosor: number; borrador?: boolean }
export type VideosDe = { camara?: MediaStream; pantalla?: MediaStream }

export type JugadorJuego = { usuario_id: number; username: string }
export type EstadoJuego = {
  tipo: 'tateti' | 'ppt'
  nombre: string
  jugadores: JugadorJuego[]
  estado: 'esperando' | 'jugando' | 'terminado'
  ganador: number | null
  empate: boolean
  puntos_por_ganar: number
  // ta-te-ti
  tablero?: (number | null)[]
  turno?: number | null
  linea_ganadora?: number[] | null
  // piedra, papel o tijera
  ya_eligieron?: number[]
  marcador?: Record<string, number>
  ultima_ronda?: { elecciones: Record<string, string>; ganador: number | null } | null
}

type DatosSenal =
  | { tipo: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit }
  | { tipo: 'ice'; candidate: RTCIceCandidateInit }

/** Los dos lugares para video de una conexión: [cámara, pantalla]. */
function lugaresDeVideo(pc: RTCPeerConnection): RTCRtpTransceiver[] {
  return pc.getTransceivers().filter((t) => t.receiver.track?.kind === 'video')
}

export function useVoz() {
  const [canal, setCanal] = useState<{ id: number; nombre: string } | null>(null)
  const [estado, setEstado] = useState<EstadoVoz>('desconectado')
  const [participantes, setParticipantes] = useState<ParticipanteVoz[]>([]) // los demás (sin mí)
  const [silenciado, setSilenciado] = useState(false)
  const [hablando, setHablando] = useState<Record<number, boolean>>({}) // incluye mi id
  const [error, setError] = useState<string | null>(null)
  const [camaraLocal, setCamaraLocal] = useState<MediaStream | null>(null)
  const [pantallaLocal, setPantallaLocal] = useState<MediaStream | null>(null)
  const [videos, setVideos] = useState<Record<number, VideosDe>>({})
  const [trazos, setTrazos] = useState<Trazo[]>([])
  const [juego, setJuego] = useState<EstadoJuego | null>(null)
  const [avisoJuego, setAvisoJuego] = useState<string | null>(null)

  const ws = useRef<WebSocket | null>(null)
  const microfono = useRef<MediaStream | null>(null)
  const pistaCamara = useRef<MediaStreamTrack | null>(null)
  const pistaPantalla = useRef<MediaStreamTrack | null>(null)
  const peers = useRef(new Map<number, RTCPeerConnection>())
  const audios = useRef(new Map<number, HTMLAudioElement>())
  const candidatosPendientes = useRef(new Map<number, RTCIceCandidateInit[]>())
  const audioCtx = useRef<AudioContext | null>(null)
  const medidores = useRef(new Map<number, AnalyserNode>())
  const intervalo = useRef<number | null>(null)

  // ---------- utilidades ----------
  const enviar = useCallback((mensaje: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(mensaje))
  }, [])

  /** Mide el volumen de un audio para saber si esa persona está hablando. */
  const medir = useCallback((usuarioId: number, stream: MediaStream) => {
    try {
      audioCtx.current ??= new AudioContext()
      const analizador = audioCtx.current.createAnalyser()
      analizador.fftSize = 512
      audioCtx.current.createMediaStreamSource(stream).connect(analizador)
      medidores.current.set(usuarioId, analizador)
    } catch {
      // Si el navegador no lo soporta, simplemente no mostramos el indicador.
    }
    if (intervalo.current === null) {
      const datos = new Float32Array(512)
      intervalo.current = window.setInterval(() => {
        const nuevo: Record<number, boolean> = {}
        medidores.current.forEach((a, id) => {
          a.getFloatTimeDomainData(datos)
          let suma = 0
          for (const v of datos) suma += v * v
          nuevo[id] = Math.sqrt(suma / datos.length) > UMBRAL_HABLANDO
        })
        setHablando((prev) => {
          const iguales =
            Object.keys(nuevo).length === Object.keys(prev).length &&
            Object.entries(nuevo).every(([k, v]) => prev[Number(k)] === v)
          return iguales ? prev : nuevo
        })
      }, 150)
    }
  }, [])

  const cerrarPeer = useCallback((usuarioId: number) => {
    peers.current.get(usuarioId)?.close()
    peers.current.delete(usuarioId)
    const audio = audios.current.get(usuarioId)
    if (audio) {
      audio.pause()
      audio.srcObject = null
    }
    audios.current.delete(usuarioId)
    medidores.current.delete(usuarioId)
    candidatosPendientes.current.delete(usuarioId)
    setVideos((prev) => {
      const { [usuarioId]: _, ...resto } = prev
      return resto
    })
  }, [])

  /** Libera todo: conexiones, micrófono, cámara, pantalla y medidores. */
  const limpiar = useCallback(() => {
    Array.from(peers.current.keys()).forEach(cerrarPeer)
    microfono.current?.getTracks().forEach((t) => t.stop())
    microfono.current = null
    pistaCamara.current?.stop()
    pistaCamara.current = null
    pistaPantalla.current?.stop()
    pistaPantalla.current = null
    medidores.current.clear()
    if (intervalo.current !== null) window.clearInterval(intervalo.current)
    intervalo.current = null
    audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    ws.current = null
    setParticipantes([])
    setHablando({})
    setSilenciado(false)
    setCamaraLocal(null)
    setPantallaLocal(null)
    setVideos({})
    setTrazos([])
    setJuego(null)
    setAvisoJuego(null)
    setEstado('desconectado')
    setCanal(null)
  }, [cerrarPeer])

  /** Pone nuestra cámara y pantalla actuales en los lugares de video de una conexión. */
  const ponerVideos = useCallback((pc: RTCPeerConnection) => {
    const [lugarCamara, lugarPantalla] = lugaresDeVideo(pc)
    lugarCamara?.sender.replaceTrack(pistaCamara.current).catch(() => {})
    lugarPantalla?.sender.replaceTrack(pistaPantalla.current).catch(() => {})
  }, [])

  // ---------- conexión con otro participante ----------
  const crearPeer = useCallback(
    (usuarioId: number, iniciador: boolean) => {
      const pc = new RTCPeerConnection(CONFIG_RTC)
      // Mandamos nuestro micrófono a esta persona.
      microfono.current?.getTracks().forEach((pista) => pc.addTrack(pista, microfono.current!))
      // Quien manda la oferta crea los dos lugares para video (cámara y pantalla).
      // Quien responde los recibe con la oferta (ver manejarSenal).
      if (iniciador) {
        pc.addTransceiver('video', { direction: 'sendrecv' })
        pc.addTransceiver('video', { direction: 'sendrecv' })
        ponerVideos(pc)
      }
      // Cada camino de red que descubre el navegador se lo pasamos al otro.
      pc.onicecandidate = (e) => {
        if (e.candidate) enviar({ tipo: 'senal', para: usuarioId, datos: { tipo: 'ice', candidate: e.candidate.toJSON() } })
      }
      pc.ontrack = (e) => {
        if (e.track.kind === 'audio') {
          // Cuando llega su audio, lo reproducimos.
          const stream = e.streams[0] ?? new MediaStream([e.track])
          const audio = new Audio()
          audio.autoplay = true
          audio.srcObject = stream
          audio.play().catch(() => {})
          audios.current.set(usuarioId, audio)
          medir(usuarioId, stream)
        } else {
          // Video: el primer lugar es la cámara y el segundo, la pantalla.
          const tipo = lugaresDeVideo(pc).indexOf(e.transceiver) === 1 ? 'pantalla' : 'camara'
          const stream = new MediaStream([e.track])
          setVideos((prev) => ({ ...prev, [usuarioId]: { ...prev[usuarioId], [tipo]: stream } }))
        }
      }
      peers.current.set(usuarioId, pc)
      return pc
    },
    [enviar, medir, ponerVideos],
  )

  const aplicarPendientes = useCallback(async (usuarioId: number, pc: RTCPeerConnection) => {
    for (const c of candidatosPendientes.current.get(usuarioId) ?? []) {
      await pc.addIceCandidate(c).catch(() => {})
    }
    candidatosPendientes.current.delete(usuarioId)
  }, [])

  const manejarSenal = useCallback(
    async (de: number, datos: DatosSenal) => {
      if (datos.tipo === 'offer') {
        // Alguien nuevo nos ofrece conectarse: le respondemos.
        const pc = peers.current.get(de) ?? crearPeer(de, false)
        await pc.setRemoteDescription(datos.sdp)
        // Los lugares de video llegaron con la oferta: los usamos para mandar también.
        for (const t of lugaresDeVideo(pc)) t.direction = 'sendrecv'
        ponerVideos(pc)
        await aplicarPendientes(de, pc)
        await pc.setLocalDescription(await pc.createAnswer())
        enviar({ tipo: 'senal', para: de, datos: { tipo: 'answer', sdp: pc.localDescription } })
      } else if (datos.tipo === 'answer') {
        const pc = peers.current.get(de)
        if (!pc) return
        await pc.setRemoteDescription(datos.sdp)
        await aplicarPendientes(de, pc)
      } else if (datos.tipo === 'ice') {
        const pc = peers.current.get(de)
        // Si todavía no llegó la oferta/respuesta, guardamos el candidato para después.
        if (!pc || !pc.remoteDescription) {
          const lista = candidatosPendientes.current.get(de) ?? []
          lista.push(datos.candidate)
          candidatosPendientes.current.set(de, lista)
        } else {
          await pc.addIceCandidate(datos.candidate).catch(() => {})
        }
      }
    },
    [aplicarPendientes, crearPeer, enviar, ponerVideos],
  )

  /** Le mandamos una oferta a alguien que ya estaba en el canal. */
  const ofrecer = useCallback(
    async (usuarioId: number) => {
      const pc = crearPeer(usuarioId, true)
      await pc.setLocalDescription(await pc.createOffer())
      enviar({ tipo: 'senal', para: usuarioId, datos: { tipo: 'offer', sdp: pc.localDescription } })
    },
    [crearPeer, enviar],
  )

  // ---------- acciones públicas ----------
  const salir = useCallback(() => {
    const socket = ws.current
    limpiar()
    socket?.close()
  }, [limpiar])

  const entrar = useCallback(
    async (nuevoCanal: { id: number; nombre: string }, yoId: number) => {
      salir()
      setError(null)
      setEstado('conectando')
      setCanal(nuevoCanal)

      // 1. Micrófono (el navegador le pide permiso al usuario).
      try {
        microfono.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        })
      } catch {
        setError('No pudimos usar tu micrófono. Revisá que el navegador tenga permiso para usarlo.')
        limpiar()
        return
      }
      medir(yoId, microfono.current)

      // 2. WebSocket de señalización.
      const socket = new WebSocket(urlVoz(nuevoCanal.id))
      ws.current = socket

      socket.onmessage = async (evento) => {
        const msg = JSON.parse(evento.data)
        switch (msg.tipo) {
          case 'bienvenida':
            setParticipantes(msg.participantes)
            setTrazos(msg.pizarra ?? [])
            setJuego(msg.juego ?? null)
            setEstado('conectado')
            // 3. Le mandamos una oferta a cada uno de los que ya estaban.
            for (const p of msg.participantes as ParticipanteVoz[]) await ofrecer(p.usuario_id)
            break
          case 'entro':
            // El que entra es quien nos va a mandar la oferta a nosotros.
            setParticipantes((prev) => [...prev.filter((p) => p.usuario_id !== msg.participante.usuario_id), msg.participante])
            break
          case 'salio':
            cerrarPeer(msg.usuario_id)
            setParticipantes((prev) => prev.filter((p) => p.usuario_id !== msg.usuario_id))
            break
          case 'senal':
            await manejarSenal(msg.de, msg.datos)
            break
          case 'estado':
            setParticipantes((prev) =>
              prev.map((p) =>
                p.usuario_id === msg.usuario_id
                  ? { ...p, silenciado: msg.silenciado, camara: msg.camara, pantalla: msg.pantalla }
                  : p,
              ),
            )
            break
          case 'pizarra':
            if (msg.accion === 'trazo') setTrazos((prev) => [...prev, msg.trazo])
            if (msg.accion === 'limpiar') setTrazos([])
            break
          case 'juego':
            setJuego(msg.juego)
            setAvisoJuego(msg.aviso ?? null)
            break
          case 'juego_error':
            setAvisoJuego(msg.mensaje)
            break
          case 'error':
            setError(msg.mensaje)
            break
        }
      }

      socket.onclose = () => {
        // Si se cortó solo (no porque apretamos "Salir"), limpiamos todo.
        if (ws.current === socket) limpiar()
      }
      socket.onerror = () => {
        setError((e) => e ?? 'No pudimos conectarnos al canal de voz. Revisá que la API esté funcionando.')
      }
    },
    [cerrarPeer, limpiar, manejarSenal, medir, ofrecer, salir],
  )

  const alternarSilencio = useCallback(() => {
    setSilenciado((actual) => {
      const nuevo = !actual
      // Apagar la pista del micrófono hace que los demás reciban silencio.
      microfono.current?.getAudioTracks().forEach((t) => (t.enabled = !nuevo))
      enviar({ tipo: 'estado', silenciado: nuevo })
      return nuevo
    })
  }, [enviar])

  /** Pone (o saca) una pista de video en el lugar indicado de todas las conexiones. */
  const repartirVideo = useCallback((lugar: 0 | 1, pista: MediaStreamTrack | null) => {
    peers.current.forEach((pc) => {
      lugaresDeVideo(pc)[lugar]?.sender.replaceTrack(pista).catch(() => {})
    })
  }, [])

  const apagarCamara = useCallback(() => {
    pistaCamara.current?.stop()
    pistaCamara.current = null
    repartirVideo(0, null)
    setCamaraLocal(null)
    enviar({ tipo: 'estado', camara: false })
  }, [enviar, repartirVideo])

  const alternarCamara = useCallback(async () => {
    if (pistaCamara.current) {
      apagarCamara()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
      const pista = stream.getVideoTracks()[0]
      pistaCamara.current = pista
      repartirVideo(0, pista)
      setCamaraLocal(stream)
      enviar({ tipo: 'estado', camara: true })
    } catch {
      setError('No pudimos usar tu cámara. Revisá que el navegador tenga permiso para usarla.')
    }
  }, [apagarCamara, enviar, repartirVideo])

  const dejarDeCompartir = useCallback(() => {
    pistaPantalla.current?.stop()
    pistaPantalla.current = null
    repartirVideo(1, null)
    setPantallaLocal(null)
    enviar({ tipo: 'estado', pantalla: false })
  }, [enviar, repartirVideo])

  const alternarPantalla = useCallback(async () => {
    if (pistaPantalla.current) {
      dejarDeCompartir()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const pista = stream.getVideoTracks()[0]
      // Si se deja de compartir desde el botón del navegador, avisamos igual.
      pista.onended = () => {
        if (pistaPantalla.current === pista) dejarDeCompartir()
      }
      pistaPantalla.current = pista
      repartirVideo(1, pista)
      setPantallaLocal(stream)
      enviar({ tipo: 'estado', pantalla: true })
    } catch {
      // Canceló el diálogo de elegir pantalla: no es un error.
    }
  }, [dejarDeCompartir, enviar, repartirVideo])

  // ---------- pizarra ----------
  const dibujar = useCallback(
    (trazo: Trazo) => {
      setTrazos((prev) => [...prev, trazo])
      enviar({ tipo: 'pizarra', accion: 'trazo', trazo })
    },
    [enviar],
  )
  const limpiarPizarra = useCallback(() => enviar({ tipo: 'pizarra', accion: 'limpiar' }), [enviar])

  // ---------- juegos ----------
  const accionJuego = useCallback(
    (datos: { accion: 'crear' | 'unirse' | 'jugar' | 'cancelar'; juego?: string; casilla?: number; eleccion?: string }) => {
      setAvisoJuego(null)
      enviar({ tipo: 'juego', ...datos })
    },
    [enviar],
  )

  // Si se cierra la pantalla, cortamos la llamada.
  useEffect(() => () => salir(), [salir])

  return {
    canal,
    estado,
    participantes,
    silenciado,
    hablando,
    error,
    camaraLocal,
    pantallaLocal,
    videos,
    trazos,
    juego,
    avisoJuego,
    entrar,
    salir,
    alternarSilencio,
    alternarCamara,
    alternarPantalla,
    dibujar,
    limpiarPizarra,
    accionJuego,
  }
}

export type Voz = ReturnType<typeof useVoz>
