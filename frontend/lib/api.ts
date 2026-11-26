import type { Preferencias } from './apariencia'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
export const TOKEN_KEY = 'kort_token'

export type Usuario = {
  id: number
  email: string
  username: string
  fecha_registro: string
  bio?: string | null
  avatar_url?: string | null
}
export type Servidor = {
  id: number
  nombre: string
  duenio_id: number
  fecha_creacion: string
  expira_en?: string | null
  icono_url?: string | null
}
export type TipoCanal = 'texto' | 'voz'
export type Canal = {
  id: number
  servidor_id: number
  nombre: string
  tipo: TipoCanal
  solo_lectura: boolean
}
export type Rol = {
  id: number
  servidor_id: number
  nombre: string
  puede_escribir: boolean
  puede_moderar: boolean
  puede_invitar: boolean
}
export type Miembro = {
  usuario_id: number
  username: string
  apodo?: string | null
  avatar_url?: string | null
  fecha_union: string
  es_duenio: boolean
  roles: { id: number; nombre: string }[]
}
export type Invitacion = {
  id: number
  servidor_id: number
  creador_id: number
  codigo: string
  usos_maximos: number
  usos: number
  fecha_vencimiento: string
}
export type TipoAdjunto = 'imagen' | 'audio' | 'video' | 'archivo'
export type Adjunto = { url: string; tipo: TipoAdjunto; nombre?: string | null }
export type Reaccion = { emoji: string; cantidad: number; usuarios: number[] }
export type Encuesta = {
  id: number
  multiple: boolean
  fecha_limite: string | null
  cerrada: boolean
  total_votantes: number
  opciones: { id: number; texto: string; votos: number }[]
  mis_votos: number[]
}
export type Mensaje = {
  id: number
  canal_id: number
  autor_id: number
  autor_username: string
  autor_apodo?: string | null
  autor_avatar_url?: string | null
  contenido: string
  fecha: string
  editado: boolean
  fijado?: boolean
  adjunto?: Adjunto | null
  reacciones?: Reaccion[]
  encuesta?: Encuesta | null
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

function extraerMensaje(body: unknown, status: number): { message: string; code?: string } {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b.message === 'string') {
      return { message: b.message, code: typeof b.error === 'string' ? b.error : undefined }
    }
    if (Array.isArray(b.detail)) {
      const msgs = b.detail
        .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : ''))
        .filter(Boolean)
      if (msgs.length) return { message: msgs.join(' · '), code: 'validacion' }
    }
    if (typeof b.detail === 'string') return { message: b.detail }
  }
  return { message: `Algo salió mal (error ${status}). Probá de nuevo.` }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
}

async function request<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const esFormulario = body instanceof FormData
  if (body !== undefined && !esFormulario) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: esFormulario ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'No pudimos conectarnos con el servidor de Kort. Revisá que la API esté funcionando.')
  }

  if (res.status === 204) return undefined as T

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const { message, code } = extraerMensaje(data, res.status)
    if (res.status === 401 && auth && typeof window !== 'undefined') {
      clearToken()
      const actual = window.location.pathname + window.location.search
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?next=${encodeURIComponent(actual)}`
      }
    }
    throw new ApiError(res.status, message, code)
  }

  return data as T
}

// Usuarios y auth
export const registrarUsuario = (datos: { email: string; username: string; password: string }) =>
  request<Usuario>('/usuarios/', { method: 'POST', body: datos, auth: false })

export const login = (datos: { email: string; password: string }) =>
  request<{ access_token: string; token_type: string }>('/auth/login', {
    method: 'POST',
    body: datos,
    auth: false,
  })

export const getMe = () => request<Usuario>('/auth/me')

export const getServidoresDeUsuario = (usuarioId: number) =>
  request<Servidor[]>(`/usuarios/${usuarioId}/servidores`)

// Servidores
export const crearServidor = (nombre: string, duracionHoras: number | null = null) =>
  request<Servidor>('/servidores/', { method: 'POST', body: { nombre, duracion_horas: duracionHoras } })

/** Guarda el orden en que el usuario quiere ver sus servidores. */
export const ordenarServidores = (servidorIds: number[]) =>
  request<Servidor[]>('/usuarios/me/servidores/orden', { method: 'PUT', body: { servidor_ids: servidorIds } })

export const getServidor = (id: number) => request<Servidor>(`/servidores/${id}`)

export const getCanales = (servidorId: number) => request<Canal[]>(`/servidores/${servidorId}/canales`)

export const crearCanal = (servidorId: number, datos: { nombre: string; tipo: TipoCanal; solo_lectura: boolean }) =>
  request<Canal>(`/servidores/${servidorId}/canales`, { method: 'POST', body: datos })

export const getRoles = (servidorId: number) => request<Rol[]>(`/servidores/${servidorId}/roles`)

export const getMiembros = (servidorId: number) => request<Miembro[]>(`/servidores/${servidorId}/miembros`)

// Invitaciones
export const crearInvitacion = (servidorId: number, datos: { usos_maximos: number; fecha_vencimiento: string }) =>
  request<Invitacion>(`/servidores/${servidorId}/invitaciones`, { method: 'POST', body: datos })

export const usarInvitacion = (codigo: string) =>
  request<Servidor>(`/invitaciones/${encodeURIComponent(codigo)}/usar`, { method: 'POST' })

// Mensajes
export const getMensajes = (canalId: number, opciones: { limite?: number; antes_de?: number } = {}) => {
  const params = new URLSearchParams()
  params.set('limite', String(opciones.limite ?? 50))
  if (opciones.antes_de !== undefined) params.set('antes_de', String(opciones.antes_de))
  return request<Mensaje[]>(`/canales/${canalId}/mensajes?${params.toString()}`)
}

export const enviarMensaje = (canalId: number, contenido: string, adjunto?: Adjunto | null) =>
  request<Mensaje>(`/canales/${canalId}/mensajes`, { method: 'POST', body: { contenido, adjunto: adjunto ?? null } })

export const editarMensaje = (mensajeId: number, contenido: string) =>
  request<Mensaje>(`/mensajes/${mensajeId}`, { method: 'PATCH', body: { contenido } })

export const borrarMensaje = (mensajeId: number) =>
  request<void>(`/mensajes/${mensajeId}`, { method: 'DELETE' })

export function mensajeDeError(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Algo salió mal. Probá de nuevo.'
}

// ---------------------------------------------------------------------------
// Configuración del servidor, moderación, estadísticas y cuenta
// (agregado a mano después de v0, siguiendo el mismo patrón)
// ---------------------------------------------------------------------------

export type TopUsuario = { usuario_id: number; username: string; cantidad_mensajes: number }
export type CanalInactivo = { canal_id: number; nombre: string; ultimo_mensaje: string | null }
export type CantidadPorMes = { mes: string; cantidad: number }
export type Crecimiento = {
  total_miembros_actuales: number
  miembros_por_mes: CantidadPorMes[]
  mensajes_por_mes: CantidadPorMes[]
}

// Servidor (solo el dueño)
export const actualizarServidor = (
  id: number,
  datos: { nombre?: string; duracion_horas?: number; hacer_permanente?: boolean; icono_url?: string; quitar_icono?: boolean },
) =>
  request<Servidor>(`/servidores/${id}`, { method: 'PATCH', body: datos })

export const borrarServidor = (id: number) => request<void>(`/servidores/${id}`, { method: 'DELETE' })

export const transferirServidor = (id: number, nuevoDuenioId: number) =>
  request<Servidor>(`/servidores/${id}/transferir`, { method: 'POST', body: { nuevo_duenio_id: nuevoDuenioId } })

export const salirDelServidor = (id: number) => request<void>(`/servidores/${id}/salir`, { method: 'POST' })

// Canales (dueño o moderador)
export const actualizarCanal = (id: number, datos: { nombre?: string; solo_lectura?: boolean }) =>
  request<Canal>(`/canales/${id}`, { method: 'PATCH', body: datos })

export const borrarCanal = (id: number) => request<void>(`/canales/${id}`, { method: 'DELETE' })

// Roles (solo el dueño)
export type DatosRol = { nombre?: string; puede_escribir?: boolean; puede_moderar?: boolean; puede_invitar?: boolean }

export const crearRol = (servidorId: number, datos: DatosRol & { nombre: string }) =>
  request<Rol>(`/servidores/${servidorId}/roles`, { method: 'POST', body: datos })

export const actualizarRol = (id: number, datos: DatosRol) =>
  request<Rol>(`/roles/${id}`, { method: 'PATCH', body: datos })

export const borrarRol = (id: number) => request<void>(`/roles/${id}`, { method: 'DELETE' })

export const asignarRol = (servidorId: number, usuarioId: number, rolId: number) =>
  request<void>(`/servidores/${servidorId}/miembros/${usuarioId}/roles/${rolId}`, { method: 'POST' })

export const quitarRol = (servidorId: number, usuarioId: number, rolId: number) =>
  request<void>(`/servidores/${servidorId}/miembros/${usuarioId}/roles/${rolId}`, { method: 'DELETE' })

// Moderación (dueño o moderador)
export const expulsarMiembro = (servidorId: number, usuarioId: number) =>
  request<void>(`/servidores/${servidorId}/miembros/${usuarioId}/expulsar`, { method: 'POST' })

export const banearMiembro = (servidorId: number, usuarioId: number) =>
  request<void>(`/servidores/${servidorId}/miembros/${usuarioId}/banear`, { method: 'POST' })

// Invitaciones
export const getInvitaciones = (servidorId: number) =>
  request<Invitacion[]>(`/servidores/${servidorId}/invitaciones`)

export const borrarInvitacion = (codigo: string) =>
  request<void>(`/invitaciones/${encodeURIComponent(codigo)}`, { method: 'DELETE' })

// Estadísticas (solo el dueño)
export const getTopUsuarios = (servidorId: number) => request<TopUsuario[]>(`/servidores/${servidorId}/top-usuarios`)

export const getCanalesInactivos = (servidorId: number) =>
  request<CanalInactivo[]>(`/servidores/${servidorId}/canales-inactivos`)

export const getCrecimiento = (servidorId: number) => request<Crecimiento>(`/servidores/${servidorId}/crecimiento`)

// Mi cuenta
export const actualizarMiCuenta = (datos: { email?: string; username?: string; password?: string }) =>
  request<Usuario>('/usuarios/me', { method: 'PATCH', body: datos })

export const borrarMiCuenta = () => request<void>('/usuarios/me', { method: 'DELETE' })

// Chat de voz
export type ParticipanteVoz = {
  usuario_id: number
  username: string
  silenciado: boolean
  camara?: boolean
  pantalla?: boolean
}

export const getParticipantesVoz = (canalId: number) => request<ParticipanteVoz[]>(`/canales/${canalId}/voz`)

/** Dirección del WebSocket de señalización: http → ws (y https → wss). */
export function urlVoz(canalId: number): string {
  const token = encodeURIComponent(getToken() ?? '')
  return `${API_URL.replace(/^http/, 'ws')}/ws/voz/${canalId}?token=${token}`
}

// ---------------------------------------------------------------------------
// Archivos (imágenes, audios, videos...) y chat enriquecido
// ---------------------------------------------------------------------------

export type ArchivoSubido = { url: string; tipo: TipoAdjunto; nombre: string; tamanio: number }

export const TAMANIO_MAXIMO_ARCHIVO = 15 * 1024 * 1024

/** Sube un archivo y devuelve su URL (relativa al backend, ej: /uploads/abc.png). */
export function subirArchivo(archivo: Blob, nombre?: string) {
  const form = new FormData()
  form.append('archivo', archivo, nombre ?? (archivo instanceof File ? archivo.name : 'archivo'))
  return request<ArchivoSubido>('/archivos', { method: 'POST', body: form })
}

/** URL completa de un archivo subido (las guardamos relativas: /uploads/...). */
export function urlArchivo(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//.test(url)) return url
  return `${API_URL.replace(/\/api\/?$/, '')}${url}`
}

export const reaccionar = (mensajeId: number, emoji: string) =>
  request<Mensaje>(`/mensajes/${mensajeId}/reacciones`, { method: 'POST', body: { emoji } })

export const fijarMensaje = (mensajeId: number, fijar: boolean) =>
  request<Mensaje>(`/mensajes/${mensajeId}/fijar`, { method: fijar ? 'POST' : 'DELETE' })

export const getFijados = (canalId: number) => request<Mensaje[]>(`/canales/${canalId}/fijados`)

export function buscarMensajes(servidorId: number, q: string, canalId?: number) {
  const params = new URLSearchParams({ q })
  if (canalId) params.set('canal_id', String(canalId))
  return request<Mensaje[]>(`/servidores/${servidorId}/buscar?${params.toString()}`)
}

export type TipoMultimedia = 'imagen' | 'video' | 'audio' | 'archivo' | 'link'

export function getMultimedia(servidorId: number, tipo: TipoMultimedia, antesDe?: number) {
  const params = new URLSearchParams({ tipo })
  if (antesDe) params.set('antes_de', String(antesDe))
  return request<Mensaje[]>(`/servidores/${servidorId}/multimedia?${params.toString()}`)
}

export const crearEncuesta = (
  canalId: number,
  datos: { pregunta: string; opciones: string[]; multiple: boolean; fecha_limite: string | null },
) => request<Mensaje>(`/canales/${canalId}/encuestas`, { method: 'POST', body: datos })

export const votarEncuesta = (encuestaId: number, opcionIds: number[]) =>
  request<Mensaje>(`/encuestas/${encuestaId}/votar`, { method: 'POST', body: { opcion_ids: opcionIds } })

// ---------------------------------------------------------------------------
// Social: amigos, mensajes directos, perfil, apodos e historial
// ---------------------------------------------------------------------------

export type UsuarioResumen = { id: number; username: string; avatar_url: string | null; bio: string | null }
export type Amigo = { usuario: UsuarioResumen; desde: string }
export type Solicitud = { id: number; usuario: UsuarioResumen; fecha: string }
export type Solicitudes = { recibidas: Solicitud[]; enviadas: Solicitud[] }

export const getAmigos = () => request<Amigo[]>('/amigos')
export const getSolicitudes = () => request<Solicitudes>('/amigos/solicitudes')
export const enviarSolicitud = (username: string) =>
  request<{ estado: 'enviada' | 'amigos' }>('/amigos/solicitudes', { method: 'POST', body: { username } })
export const aceptarSolicitud = (id: number) => request<void>(`/amigos/solicitudes/${id}/aceptar`, { method: 'POST' })
export const rechazarSolicitud = (id: number) => request<void>(`/amigos/solicitudes/${id}`, { method: 'DELETE' })
export const eliminarAmigo = (usuarioId: number) => request<void>(`/amigos/${usuarioId}`, { method: 'DELETE' })

export type MensajeDirecto = {
  id: number
  autor_id: number
  destinatario_id: number
  autor_username: string
  autor_avatar_url: string | null
  contenido: string
  fecha: string
  editado: boolean
  leido: boolean
  adjunto: Adjunto | null
}
export type Conversacion = {
  usuario: UsuarioResumen
  /** null si está fijada pero todavía no se escribieron. */
  ultimo_mensaje: MensajeDirecto | null
  no_leidos: number
  fijada: boolean
}

/** Fija conversaciones arriba (en este orden). Reemplaza la lista entera. */
export const fijarConversaciones = (usuarioIds: number[]) =>
  request<Conversacion[]>('/mensajes-directos/fijados', { method: 'PUT', body: { usuario_ids: usuarioIds } })

/** Un mensaje directo con la forma de un mensaje de canal (para reusar la vista del chat). */
export function directoComoMensaje(m: MensajeDirecto): Mensaje {
  return { ...m, canal_id: 0, autor_apodo: null, fijado: false, reacciones: [], encuesta: null }
}

export const getConversaciones = () => request<Conversacion[]>('/mensajes-directos')

export function getMensajesDirectos(usuarioId: number, opciones: { limite?: number; antes_de?: number } = {}) {
  const params = new URLSearchParams({ limite: String(opciones.limite ?? 50) })
  if (opciones.antes_de !== undefined) params.set('antes_de', String(opciones.antes_de))
  return request<MensajeDirecto[]>(`/mensajes-directos/${usuarioId}?${params.toString()}`)
}

export const enviarMensajeDirecto = (usuarioId: number, contenido: string, adjunto?: Adjunto | null) =>
  request<MensajeDirecto>(`/mensajes-directos/${usuarioId}`, { method: 'POST', body: { contenido, adjunto: adjunto ?? null } })

export const editarMensajeDirecto = (id: number, contenido: string) =>
  request<MensajeDirecto>(`/mensajes-directos/mensaje/${id}`, { method: 'PATCH', body: { contenido } })

export const borrarMensajeDirecto = (id: number) => request<void>(`/mensajes-directos/mensaje/${id}`, { method: 'DELETE' })

export type RedSocial = { red: string; url: string }
export type VisibilidadFoto = 'todos' | 'amigos' | 'oculta'
export type FotoPerfil = { id: number; url: string; principal: boolean; visibilidad?: VisibilidadFoto | null }
export type Relacion = 'yo' | 'amigos' | 'enviada' | 'recibida' | 'ninguna'
export type Perfil = {
  id: number
  username: string
  bio: string | null
  avatar_url: string | null
  fecha_registro: string
  etiquetas: string[]
  redes: RedSocial[]
  fotos: FotoPerfil[]
  relacion: Relacion
  servidores_en_comun: number
}

export const getPerfil = (usuarioId: number) => request<Perfil>(`/perfiles/${usuarioId}`)
export const actualizarPerfil = (datos: { bio?: string; etiquetas?: string[]; redes?: RedSocial[] }) =>
  request<Perfil>('/perfiles/me', { method: 'PATCH', body: datos })
export const agregarFotoPerfil = (url: string) => request<Perfil>('/perfiles/me/fotos', { method: 'POST', body: { url } })
export const elegirFotoPrincipal = (id: number) => request<Perfil>(`/perfiles/me/fotos/${id}/principal`, { method: 'POST' })
export const borrarFotoPerfil = (id: number) => request<Perfil>(`/perfiles/me/fotos/${id}`, { method: 'DELETE' })

export type HistorialServidor = {
  id: number
  servidor_id: number | null
  servidor_nombre: string
  fecha_union: string
  fecha_salida: string | null
  motivo_salida: 'salio' | 'expulsado' | 'baneado' | 'servidor_borrado' | 'servidor_vencido' | null
  sigue_existiendo: boolean
}
export const getHistorialServidores = () => request<HistorialServidor[]>('/perfiles/me/historial-servidores')

export const cambiarApodo = (servidorId: number, usuarioId: number, apodo: string | null) =>
  request<Miembro>(`/servidores/${servidorId}/miembros/${usuarioId}/apodo`, { method: 'PUT', body: { apodo } })

// ---------------------------------------------------------------------------
// Publicaciones y estados
// ---------------------------------------------------------------------------

export type Publicacion = {
  id: number
  autor: UsuarioResumen
  servidor_id: number | null
  contenido: string
  imagen_url: string | null
  fecha: string
  likes: number
  me_gusta: boolean
  comentarios: number
  flyer?: Flyer | null
}
/** Flyer: invitación a un servidor dentro de una publicación o un estado. */
export type Flyer = {
  codigo: string
  servidor_id: number
  servidor_nombre: string
  servidor_icono_url?: string | null
  miembros: number
  vigente: boolean
  soy_miembro: boolean
}
export type Comentario = { id: number; publicacion_id: number; autor: UsuarioResumen; contenido: string; fecha: string }
export type Estado = {
  id: number
  contenido: string
  imagen_url: string | null
  color_fondo: string
  fecha: string
  vence: string
  flyer?: Flyer | null
}
export type EstadosDeUsuario = { usuario: UsuarioResumen; estados: Estado[] }

const conAntesDe = (ruta: string, antesDe?: number) => (antesDe ? `${ruta}?antes_de=${antesDe}` : ruta)

export const getFeed = (antesDe?: number) => request<Publicacion[]>(conAntesDe('/publicaciones/feed', antesDe))
export const getPublicacionesDePerfil = (usuarioId: number, antesDe?: number) =>
  request<Publicacion[]>(conAntesDe(`/perfiles/${usuarioId}/publicaciones`, antesDe))
export const getPublicacionesDeServidor = (servidorId: number, antesDe?: number) =>
  request<Publicacion[]>(conAntesDe(`/servidores/${servidorId}/publicaciones`, antesDe))
export const crearPublicacion = (datos: {
  contenido: string
  imagen_url: string | null
  servidor_id?: number | null
  promocionar_servidor_id?: number | null
}) =>
  request<Publicacion>('/publicaciones', { method: 'POST', body: datos })
export const borrarPublicacion = (id: number) => request<void>(`/publicaciones/${id}`, { method: 'DELETE' })
export const alternarMeGusta = (id: number) => request<Publicacion>(`/publicaciones/${id}/like`, { method: 'POST' })
export const getComentarios = (id: number) => request<Comentario[]>(`/publicaciones/${id}/comentarios`)
export const comentar = (id: number, contenido: string) =>
  request<Comentario>(`/publicaciones/${id}/comentarios`, { method: 'POST', body: { contenido } })
export const borrarComentario = (id: number) => request<void>(`/comentarios/${id}`, { method: 'DELETE' })

export const getEstados = () => request<EstadosDeUsuario[]>('/estados')
export const subirEstado = (datos: {
  contenido: string
  imagen_url: string | null
  color_fondo: string
  promocionar_servidor_id?: number | null
}) =>
  request<Estado>('/estados', { method: 'POST', body: datos })
export const borrarEstado = (id: number) => request<void>(`/estados/${id}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// Calendario, tareas y scoreboard de cada servidor
// ---------------------------------------------------------------------------

export type Evento = {
  id: number
  servidor_id: number
  creador: UsuarioResumen
  titulo: string
  descripcion: string
  lugar: string
  inicio: string
  fin: string | null
  asistentes: UsuarioResumen[]
  voy: boolean
}
export type DatosEvento = { titulo: string; descripcion: string; lugar: string; inicio: string; fin: string | null }

export const getEventos = (servidorId: number, desde: string, hasta: string) =>
  request<Evento[]>(`/servidores/${servidorId}/eventos?${new URLSearchParams({ desde, hasta }).toString()}`)
export const crearEvento = (servidorId: number, datos: DatosEvento) =>
  request<Evento>(`/servidores/${servidorId}/eventos`, { method: 'POST', body: datos })
export const editarEvento = (id: number, datos: Partial<DatosEvento>) =>
  request<Evento>(`/eventos/${id}`, { method: 'PATCH', body: datos })
export const borrarEvento = (id: number) => request<void>(`/eventos/${id}`, { method: 'DELETE' })
export const alternarAsistencia = (id: number) => request<Evento>(`/eventos/${id}/asistir`, { method: 'POST' })

export type EstadoTarea = 'pendiente' | 'en_progreso' | 'hecha'
export type Tarea = {
  id: number
  servidor_id: number
  creador: UsuarioResumen
  asignado: UsuarioResumen | null
  titulo: string
  descripcion: string
  fecha_limite: string | null
  estado: EstadoTarea
  vencida: boolean
  fecha_creacion: string
  fecha_completada: string | null
}
export type DatosTarea = {
  titulo?: string
  descripcion?: string
  asignado_id?: number | null
  fecha_limite?: string | null
  estado?: EstadoTarea
}

export const getTareas = (servidorId: number, mias = false) =>
  request<Tarea[]>(`/servidores/${servidorId}/tareas${mias ? '?mias=true' : ''}`)
export const crearTarea = (servidorId: number, datos: DatosTarea & { titulo: string }) =>
  request<Tarea>(`/servidores/${servidorId}/tareas`, { method: 'POST', body: datos })
export const editarTarea = (id: number, datos: DatosTarea) => request<Tarea>(`/tareas/${id}`, { method: 'PATCH', body: datos })
export const borrarTarea = (id: number) => request<void>(`/tareas/${id}`, { method: 'DELETE' })

export type Puntaje = {
  posicion: number
  usuario: UsuarioResumen
  apodo: string | null
  puntos: number
  mensajes_30_dias: number
  tareas_hechas: number
}
export type MovimientoPuntos = {
  id: number
  usuario: UsuarioResumen
  otorgado_por: UsuarioResumen | null
  cantidad: number
  motivo: string
  fecha: string
}

export const getScoreboard = (servidorId: number) => request<Puntaje[]>(`/servidores/${servidorId}/scoreboard`)
export const getMovimientosPuntos = (servidorId: number) => request<MovimientoPuntos[]>(`/servidores/${servidorId}/puntos`)
export const darPuntos = (servidorId: number, datos: { usuario_id: number; cantidad: number; motivo: string }) =>
  request<Puntaje[]>(`/servidores/${servidorId}/puntos`, { method: 'POST', body: datos })

// ---------------------------------------------------------------------------
// Apariencia
// ---------------------------------------------------------------------------

export const getPreferencias = () => request<Preferencias>('/preferencias')
export const guardarPreferencias = (p: Preferencias) => request<Preferencias>('/preferencias', { method: 'PUT', body: p })

// ---------------------------------------------------------------------------
// Kort Wrapped
// ---------------------------------------------------------------------------

export type Wrapped = {
  anio: number
  username: string
  total_mensajes: number
  total_palabras: number
  total_mensajes_directos: number
  dias_activos: number
  racha_mas_larga: number
  mensajes_por_mes: number[]
  mes_mas_activo: string | null
  hora_pico: number | null
  dia_favorito: string | null
  canal_favorito: { canal: string; servidor: string; cantidad: number } | null
  servidores_mas_activos: { nombre: string; cantidad: number }[]
  emojis_favoritos: { nombre: string; cantidad: number }[]
  reacciones_recibidas: number
  persona_favorita: { usuario: UsuarioResumen; cantidad: number } | null
  amigos_nuevos: number
  servidores_nuevos: number
  publicaciones: number
  likes_recibidos: number
  tareas_completadas: number
  eventos_asistidos: number
  puntos_ganados: number
  personalidad: { titulo: string; descripcion: string; emoji: string }
}

export const getWrapped = (anio: number) => request<Wrapped>(`/perfiles/me/wrapped?anio=${anio}`)

// ---------------------------------------------------------------------------
// Fotos por servidor, visibilidad de fotos y orden personal de las pestañas
// ---------------------------------------------------------------------------

export const cambiarVisibilidadFoto = (id: number, visibilidad: VisibilidadFoto) =>
  request<Perfil>(`/perfiles/me/fotos/${id}`, { method: 'PATCH', body: { visibilidad } })

/** Lo que cada uno configura para sí mismo en un servidor. */
/** Carpeta personal de pestañas (solo la ve quien la creó). */
export type Carpeta = { id: string; nombre: string; items: string[] }
export type MiMembresia = {
  apodo: string | null
  foto_id: number | null
  orden_secciones: string[] | null
  carpetas: Carpeta[]
}

export const getMiMembresia = (servidorId: number) => request<MiMembresia>(`/servidores/${servidorId}/mi-membresia`)
export const elegirMiFoto = (servidorId: number, fotoId: number | null) =>
  request<MiMembresia>(`/servidores/${servidorId}/mi-foto`, { method: 'PUT', body: { foto_id: fotoId } })
export const ordenarMisSecciones = (servidorId: number, orden: string[], carpetas: Carpeta[] = []) =>
  request<MiMembresia>(`/servidores/${servidorId}/mi-orden`, { method: 'PUT', body: { orden, carpetas } })
