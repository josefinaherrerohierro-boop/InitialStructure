export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
export const TOKEN_KEY = 'kort_token'

export type Usuario = { id: number; email: string; username: string; fecha_registro: string }
export type Servidor = { id: number; nombre: string; duenio_id: number; fecha_creacion: string }
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
export type Mensaje = {
  id: number
  canal_id: number
  autor_id: number
  autor_username: string
  contenido: string
  fecha: string
  editado: boolean
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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

async function request<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
export const crearServidor = (nombre: string) =>
  request<Servidor>('/servidores/', { method: 'POST', body: { nombre } })

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

export const enviarMensaje = (canalId: number, contenido: string) =>
  request<Mensaje>(`/canales/${canalId}/mensajes`, { method: 'POST', body: { contenido } })

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
export const actualizarServidor = (id: number, datos: { nombre: string }) =>
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
