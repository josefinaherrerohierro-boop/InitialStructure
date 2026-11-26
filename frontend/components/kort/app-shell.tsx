'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR, { SWRConfig } from 'swr'
import { AtSign, Compass, Images, Menu, MessageSquare, Moon, Newspaper, Phone, Pin, Search, Sun, Users, X } from 'lucide-react'
import {
  ApiError,
  clearToken,
  getCanales,
  getMe,
  getMiembros,
  getRoles,
  getFeed,
  getPublicacionesDePerfil,
  getPreferencias,
  guardarPreferencias,
  getPublicacionesDeServidor,
  getServidoresDeUsuario,
  getToken,
  mensajeDeError,
  ordenarServidores,
  type Servidor,
  type UsuarioResumen,
} from '@/lib/api'
import {
  aplicarApariencia,
  CLAVE_APARIENCIA,
  PREFERENCIAS_POR_DEFECTO,
  TEMAS_CLAROS,
  temaEfectivo,
  type Preferencias,
} from '@/lib/apariencia'
import { calcularPermisos } from '@/lib/kort'
import { mismaSala, useVoz } from '@/lib/use-voz'
import { LlamadasEntrantes } from './llamadas-entrantes'
import { BuscadorServidores } from './buscador-servidores'
import { cn } from '@/lib/utils'
import { AjustesUsuario } from './ajustes/ajustes-usuario'
import { AccionesServidor, MenuUsuario, PestaniasServidores } from './barra-superior'
import { AparienciaTab } from './ajustes/apariencia-tab'
import { CalendarioView } from './calendario'
import { BarraServidor, type VistaServidor } from './barra-servidor'
import { SeccionesServidor } from './secciones-servidor'
import { ConfiguracionServidor } from './config/configuracion-servidor'
import { ChatPanel, DirectoPanel } from './chat-panel'
import { EmptyState } from './empty-state'
import { ExplorarView } from './explorar'
import { EstadosBarra } from './estados'
import { AmigosView, InicioSidebar, usePendientesInicio, type SeleccionInicio } from './inicio'
import { MembersPanel } from './members-panel'
import { CrearCanalModal, CrearServidorModal, InvitarModal, UnirmeModal } from './modals'
import { BusquedaPanel, FijadosPanel, MultimediaPanel } from './paneles-chat'
import { PerfilModal } from './perfil-modal'
import { PublicacionesLista } from './publicaciones'
import { ResumenServidor } from './resumen-servidor'
import { ScoreboardView } from './scoreboard'
import { TareasView } from './tareas'
import { ServerSelector } from './server-selector'
import { useToast } from './toast-provider'
import { Avatar, Logo } from './ui'
import { VoicePanel, VozBar } from './voice-panel'
import { WrappedHistoria, WrappedTab } from './wrapped'

type PanelDerecho = 'miembros' | 'fijados' | 'buscar' | 'multimedia' | null
type ModalAbierto = 'crearServidor' | 'unirme' | 'crearCanal' | 'invitar' | 'configuracion' | 'ajustes' | null

export function AppShell() {
  const toast = useToast()
  return (
    <SWRConfig
      value={{
        onError: (err) => {
          if (err instanceof ApiError && err.status === 401) return
          toast.error(mensajeDeError(err))
        },
        shouldRetryOnError: false,
        // Datos guardados nuevos cada vez que se entra a la app: si antes había
        // otra cuenta (cerrar sesión → crear cuenta o entrar con otra), no se
        // mezclan sus servidores con los de la cuenta nueva.
        provider: () => new Map(),
      }}
    >
      <AppShellInterno />
    </SWRConfig>
  )
}

function AppShellInterno() {
  const router = useRouter()
  const toast = useToast()
  const params = useSearchParams()
  const [listo, setListo] = useState(false)
  const [servidorElegido, setServidorElegido] = useState<number | undefined>(() => {
    const v = Number(params.get('servidor'))
    return Number.isFinite(v) && v > 0 ? v : undefined
  })
  const [enInicio, setEnInicio] = useState(() => params.has('inicio'))
  // Explorar servidores públicos (ocupa el centro, como Inicio).
  const [enExplorar, setEnExplorar] = useState(false)
  const [seleccionInicio, setSeleccionInicio] = useState<SeleccionInicio>({ tipo: 'amigos' })
  const [canalPorServidor, setCanalPorServidor] = useState<Record<number, number>>({})
  // Qué se ve en el centro de cada servidor: el resumen, una herramienta o (null) un canal.
  const [herramientaPorServidor, setHerramientaPorServidor] = useState<Record<number, VistaServidor | null>>({})
  // En pantallas chicas el panel derecho arranca cerrado (si no, tapa el chat).
  const [panel, setPanel] = useState<PanelDerecho>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? null : 'miembros',
  )
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [perfilAbierto, setPerfilAbierto] = useState<number | null>(null)
  const [wrappedAbierto, setWrappedAbierto] = useState(false)
  // Llamada ampliada: se ocultan los paneles de los costados y el encabezado del servidor.
  const [llamadaAmpliada, setLlamadaAmpliada] = useState(false)
  // Chat de voz: vive acá para que la llamada siga aunque mires otro canal.
  const voz = useVoz()
  // En un mensaje directo: id de la persona cuya llamada estamos mirando (en vez del chat).
  const [llamadaDmAbierta, setLlamadaDmAbierta] = useState<number | null>(null)
  // Cuando termina una llamada por mensaje directo, volvemos al chat.
  const estadoVozAnterior = useRef(voz.estado)
  useEffect(() => {
    if (estadoVozAnterior.current === 'conectado' && voz.estado !== 'conectado') setLlamadaDmAbierta(null)
    estadoVozAnterior.current = voz.estado
  }, [voz.estado])

  useEffect(() => {
    if (!getToken()) {
      const actual = window.location.pathname + window.location.search
      router.replace(`/login?next=${encodeURIComponent(actual)}`)
      return
    }
    setListo(true)
  }, [router])

  const { data: yo, mutate: mutateYo } = useSWR(listo ? 'me' : null, getMe)
  // Apariencia guardada en la cuenta: se aplica apenas llega.
  const { data: preferencias, mutate: mutatePreferencias } = useSWR(listo ? 'preferencias' : null, getPreferencias, {
    onSuccess: aplicarApariencia,
    revalidateOnFocus: false,
  })
  const disposicion = preferencias?.disposicion ?? 'horizontal'

  /** Cambia algo de la apariencia (modo claro/oscuro, disposición): se ve al instante y se guarda. */
  async function cambiarPreferencias(cambios: Partial<Preferencias>) {
    const nuevas = { ...PREFERENCIAS_POR_DEFECTO, ...preferencias, ...cambios }
    aplicarApariencia(nuevas)
    try {
      await mutatePreferencias(guardarPreferencias(nuevas), { optimisticData: nuevas, rollbackOnError: true, revalidate: false })
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  const modoOscuro = !TEMAS_CLAROS.includes(temaEfectivo(preferencias?.tema ?? 'kort'))
  const {
    data: servidores,
    isLoading: cargandoServidores,
    mutate: mutateServidores,
  } = useSWR(yo ? ['servidores', yo.id] : null, () => getServidoresDeUsuario(yo!.id))
  const pendientesInicio = usePendientesInicio(!!yo && !enInicio)

  const mostrarInicio = enInicio

  const servidor = useMemo(
    () => (mostrarInicio || enExplorar ? undefined : (servidores?.find((s) => s.id === servidorElegido) ?? servidores?.[0])),
    [servidores, servidorElegido, mostrarInicio, enExplorar],
  )

  const { data: canales, isLoading: cargandoCanales, mutate: mutateCanales } = useSWR(
    servidor ? ['canales', servidor.id] : null,
    () => getCanales(servidor!.id),
  )
  const {
    data: miembros,
    isLoading: cargandoMiembros,
    mutate: mutateMiembros,
  } = useSWR(servidor ? ['miembros', servidor.id] : null, () => getMiembros(servidor!.id))
  const { data: roles, mutate: mutateRoles } = useSWR(servidor ? ['roles', servidor.id] : null, () =>
    getRoles(servidor!.id),
  )

  // Al entrar a un servidor se ve primero su Resumen.
  const herramienta: VistaServidor | null = servidor
    ? herramientaPorServidor[servidor.id] === undefined
      ? 'resumen'
      : herramientaPorServidor[servidor.id]
    : null

  const permisos = useMemo(() => calcularPermisos(servidor, yo?.id, miembros, roles), [servidor, yo, miembros, roles])

  const canal = useMemo(() => {
    if (!servidor || !canales) return undefined
    const elegido = canalPorServidor[servidor.id]
    return canales.find((c) => c.id === elegido) ?? canales.find((c) => c.tipo === 'texto') ?? canales[0]
  }, [servidor, canales, canalPorServidor])

  function abrirExplorar() {
    setEnInicio(false)
    setEnExplorar(true)
    setMenuAbierto(false)
  }

  function seleccionarServidor(id: number) {
    setEnInicio(false)
    setEnExplorar(false)
    setServidorElegido(id)
    setMenuAbierto(false)
    router.replace(`/app?servidor=${id}`, { scroll: false })
  }

  function irAInicio(seleccion?: SeleccionInicio) {
    setEnInicio(true)
    setEnExplorar(false)
    if (seleccion) setSeleccionInicio(seleccion)
    setMenuAbierto(false)
    router.replace('/app?inicio', { scroll: false })
  }

  function abrirDirecto(usuario: UsuarioResumen) {
    setPerfilAbierto(null)
    irAInicio({ tipo: 'dm', usuario })
  }

  function seleccionarCanal(id: number) {
    if (!servidor) return
    setCanalPorServidor((prev) => ({ ...prev, [servidor.id]: id }))
    setHerramientaPorServidor((prev) => ({ ...prev, [servidor.id]: null }))
    setMenuAbierto(false)
  }

  function seleccionarHerramienta(h: VistaServidor) {
    if (!servidor) return
    setHerramientaPorServidor((prev) => ({ ...prev, [servidor.id]: h }))
    setMenuAbierto(false)
  }

  function agregarServidor(s: Servidor) {
    mutateServidores((cur) => (cur?.some((x) => x.id === s.id) ? cur : [...(cur ?? []), s]), { revalidate: true })
    seleccionarServidor(s.id)
  }

  /** Cambia el orden de la lista al instante y lo guarda en la API. */
  async function reordenarServidores(ids: number[]) {
    const porId = new Map((servidores ?? []).map((s) => [s.id, s]))
    const nuevos = ids.map((id) => porId.get(id)).filter((s): s is Servidor => !!s)
    try {
      await mutateServidores(ordenarServidores(ids), { optimisticData: nuevos, rollbackOnError: true, revalidate: false })
    } catch (err) {
      toast.error(mensajeDeError(err))
    }
  }

  /** Vuelve a pedir todo a la API después de un cambio en la configuración. */
  function refrescarTodo() {
    mutateServidores()
    mutateCanales()
    mutateMiembros()
    mutateRoles()
  }

  /** Después de salir del servidor o borrarlo: lo sacamos de la lista. */
  function alSalirDelServidor() {
    const idActual = servidor?.id
    setModal(null)
    setServidorElegido(undefined)
    mutateServidores((cur) => cur?.filter((s) => s.id !== idActual), { revalidate: true })
    router.replace('/app', { scroll: false })
  }

  function salir() {
    voz.salir()
    // La próxima persona que entre en este navegador arranca con la apariencia original.
    aplicarApariencia(PREFERENCIAS_POR_DEFECTO)
    try {
      window.localStorage.removeItem(CLAVE_APARIENCIA)
    } catch {}
    clearToken()
    router.replace('/login')
  }

  if (!listo) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Logo className="animate-pulse text-4xl" />
      </main>
    )
  }

  const sinServidores = servidores && servidores.length === 0
  const ampliada = llamadaAmpliada && !mostrarInicio && !herramienta && canal?.tipo === 'voz'

  function alternarPanel(p: Exclude<PanelDerecho, null>) {
    setPanel((actual) => (actual === p ? null : p))
  }

  const panelContenido = !servidor
    ? null
    : panel === 'miembros'
      ? (
          <MembersPanel
            miembros={miembros}
            cargando={cargandoMiembros}
            miId={yo?.id}
            servidorId={servidor.id}
            puedeModerar={permisos.esModerador}
            onVerPerfil={setPerfilAbierto}
            onCambio={() => mutateMiembros()}
            onCerrar={() => setPanel(null)}
          />
        )
      : panel === 'fijados' && canal?.tipo === 'texto'
        ? <FijadosPanel canal={canal} onCerrar={() => setPanel(null)} />
        : panel === 'buscar'
          ? (
              <BusquedaPanel
                servidorId={servidor.id}
                canales={canales ?? []}
                onIrACanal={seleccionarCanal}
                onCerrar={() => setPanel(null)}
              />
            )
          : panel === 'multimedia'
            ? <MultimediaPanel servidorId={servidor.id} onCerrar={() => setPanel(null)} />
            : null

  /** El logo es el botón de Inicio (con el globito de pendientes). */
  const botonInicio = (
    <button
      type="button"
      onClick={() => irAInicio()}
      aria-current={mostrarInicio ? 'page' : undefined}
      aria-label={`Inicio${pendientesInicio > 0 ? `, ${pendientesInicio} sin ver` : ''}`}
      title="Inicio: amigos, mensajes directos y publicaciones"
      className={cn(
        'relative flex h-10 shrink-0 items-center rounded-full py-1 pr-3.5 pl-1.5 transition-all',
        mostrarInicio ? 'bg-surface shadow-[var(--sombra)] ring-2 ring-primary' : 'hover:bg-surface/70',
      )}
    >
      <Logo className="text-xl" />
      {pendientesInicio > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground ring-2 ring-background">
          {pendientesInicio > 99 ? '99+' : pendientesInicio}
        </span>
      )}
    </button>
  )

  /** Panel de la izquierda: solo en Inicio (amigos, mensajes directos, publicaciones). */
  const lateral = (
    <div className="flex h-full min-h-0 flex-col gap-4 p-3">
      <InicioSidebar
        onWrapped={() => setWrappedAbierto(true)}
        seleccion={seleccionInicio}
        onSeleccionar={(s) => {
          setSeleccionInicio(s)
          setMenuAbierto(false)
        }}
      />
    </div>
  )

  // ---------- Encabezado y contenido principal ----------
  let encabezado: React.ReactNode
  let contenido: React.ReactNode

  const claveVista = enExplorar
    ? 'explorar'
    : mostrarInicio
      ? `inicio-${seleccionInicio.tipo}-${seleccionInicio.tipo === 'dm' ? `${seleccionInicio.usuario.id}-${llamadaDmAbierta === seleccionInicio.usuario.id}` : ''}`
      : `servidor-${servidor?.id}-${herramienta ?? `canal-${canal?.id}`}`

  if (enExplorar) {
    encabezado = (
      <div className="flex flex-1 items-center gap-2">
        <Compass className="size-4 text-muted-foreground" aria-hidden />
        <h1 className="font-display text-[17px] font-bold">Explorar servidores</h1>
      </div>
    )
    contenido = <ExplorarView onUnido={agregarServidor} onIr={seleccionarServidor} />
  } else if (mostrarInicio) {
    if (seleccionInicio.tipo === 'dm') {
      const u = seleccionInicio.usuario
      encabezado = (
        <button type="button" onClick={() => setPerfilAbierto(u.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <AtSign className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Avatar nombre={u.username} url={u.avatar_url} tamanio="sm" />
          <h1 className="truncate font-display text-[17px] font-bold hover:underline">{u.username}</h1>
        </button>
      )
      const salaDm = { id: u.id, nombre: u.username, directo: true }
      const enLlamadaDm = mismaSala(voz.canal, salaDm)
      const viendoLlamada = llamadaDmAbierta === u.id
      encabezado = (
        <>
          {encabezado}
          {viendoLlamada ? (
            <button
              type="button"
              onClick={() => setLlamadaDmAbierta(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-elevated"
            >
              <MessageSquare className="size-4" aria-hidden />
              Ver chat
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLlamadaDmAbierta(u.id)
                if (!enLlamadaDm && yo) voz.entrar(salaDm, yo.id)
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                enLlamadaDm ? 'bg-success text-white hover:bg-success/90' : 'bg-primary text-primary-foreground hover:bg-primary-hover',
              )}
            >
              <Phone className="size-4" aria-hidden />
              {enLlamadaDm ? 'Volver a la llamada' : 'Llamar'}
            </button>
          )}
        </>
      )
      contenido =
        yo &&
        (viendoLlamada ? (
          <VoicePanel key={`dm-${u.id}`} canal={salaDm} yo={yo} voz={voz} />
        ) : (
          <DirectoPanel key={u.id} usuario={u} yo={yo} onVerPerfil={setPerfilAbierto} />
        ))
    } else if (seleccionInicio.tipo === 'feed') {
      encabezado = (
        <div className="flex flex-1 items-center gap-2">
          <Newspaper className="size-4 text-muted-foreground" aria-hidden />
          <h1 className="font-display text-[17px] font-bold">Publicaciones y estados</h1>
        </div>
      )
      contenido = yo && (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
            <EstadosBarra yo={yo} />
            <PublicacionesLista
              clave="feed"
              cargar={getFeed}
              yo={yo}
              vacio="Todavía no hay publicaciones. ¡Escribí la primera o agregá amigos!"
              onVerPerfil={setPerfilAbierto}
            />
          </div>
        </div>
      )
    } else {
      encabezado = (
        <div className="flex flex-1 items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          <h1 className="font-display text-[17px] font-bold">Amigos</h1>
        </div>
      )
      contenido = <AmigosView onMensaje={abrirDirecto} onVerPerfil={setPerfilAbierto} />
    }
  } else {
    encabezado = servidor ? (
      <BarraServidor
        servidor={servidor}
        canales={canales}
        canalId={canal?.id}
        vista={herramienta}
        permisos={permisos}
        cantidadMiembros={miembros?.length}
        onCanal={seleccionarCanal}
        onVista={seleccionarHerramienta}
        onCrearCanal={() => setModal('crearCanal')}
        onInvitar={() => setModal('invitar')}
        onConfigurar={() => setModal('configuracion')}
        orientacion={disposicion}
        onCambiarOrientacion={(o) => cambiarPreferencias({ disposicion: o })}
        onCanalesCambiados={() => mutateCanales()}
        acciones={
          <>
            {canal?.tipo === 'texto' && !herramienta && (
              <BotonPanel icono={Pin} etiqueta="Fijados" activo={panel === 'fijados'} onClick={() => alternarPanel('fijados')} />
            )}
            <BotonPanel icono={Search} etiqueta="Buscar" activo={panel === 'buscar'} onClick={() => alternarPanel('buscar')} />
            <BotonPanel icono={Images} etiqueta="Multimedia" activo={panel === 'multimedia'} onClick={() => alternarPanel('multimedia')} />
            <BotonPanel icono={Users} etiqueta="Miembros" activo={panel === 'miembros'} onClick={() => alternarPanel('miembros')} />
          </>
        }
      />
    ) : null
    contenido = sinServidores ? (
      <EmptyState onCrear={() => setModal('crearServidor')} onUnirme={() => setModal('unirme')} />
    ) : herramienta && servidor && yo ? (
      herramienta === 'resumen' ? (
        <ResumenServidor
          key={servidor.id}
          servidor={servidor}
          canales={canales ?? []}
          yo={yo}
          onVista={seleccionarHerramienta}
          onCanal={seleccionarCanal}
          onVerPerfil={setPerfilAbierto}
        />
      ) : herramienta === 'publicaciones' ? (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            <PublicacionesLista
              key={servidor.id}
              clave={'servidor-' + servidor.id}
              cargar={(antesDe) => getPublicacionesDeServidor(servidor.id, antesDe)}
              yo={yo}
              servidorId={servidor.id}
              permitirPublicar={permisos.puedeEscribir}
              puedeModerar={permisos.esModerador}
              vacio="Nadie publicó nada en este servidor todavía."
              onVerPerfil={setPerfilAbierto}
            />
          </div>
        </div>
      ) : herramienta === 'calendario' ? (
        <CalendarioView
          key={servidor.id}
          servidorId={servidor.id}
          miId={yo.id}
          permisos={permisos}
          onVerTareas={() => seleccionarHerramienta('tareas')}
        />
      ) : herramienta === 'tareas' ? (
        <TareasView key={servidor.id} servidorId={servidor.id} miId={yo.id} miembros={miembros ?? []} permisos={permisos} />
      ) : (
        <ScoreboardView
          key={servidor.id}
          servidorId={servidor.id}
          miId={yo.id}
          miembros={miembros ?? []}
          permisos={permisos}
          onVerPerfil={setPerfilAbierto}
        />
      )
    ) : canal && yo ? (
      canal.tipo === 'voz' ? (
        <VoicePanel canal={canal} yo={yo} voz={voz} ampliada={llamadaAmpliada} onAmpliar={setLlamadaAmpliada} />
      ) : (
        <ChatPanel key={canal.id} canal={canal} yo={yo} permisos={permisos} onVerPerfil={setPerfilAbierto} />
      )
    ) : canales && canales.length === 0 ? (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Este servidor todavía no tiene canales.
      </div>
    ) : (
      <div className="flex flex-1 items-center justify-center">
        <Logo className="animate-pulse text-3xl opacity-60" />
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Barra superior: logo, Inicio, pestañas de servidores y mi cuenta */}
      <header className="flex h-16 shrink-0 items-center gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="rounded-full p-2 text-muted-foreground hover:bg-surface hover:text-foreground md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        {botonInicio}
        <div className="hidden h-6 w-px shrink-0 bg-border md:block" aria-hidden />
        <div className="hidden min-w-0 flex-1 items-center gap-1.5 md:flex">
          <PestaniasServidores
            servidores={servidores}
            seleccionadoId={servidor?.id}
            miId={yo?.id}
            onSeleccionar={seleccionarServidor}
            onReordenar={reordenarServidores}
          />
          <BuscadorServidores servidores={servidores ?? []} onSeleccionar={seleccionarServidor} atajo />
          <AccionesServidor
            onCrear={() => setModal('crearServidor')}
            onUnirme={() => setModal('unirme')}
            onExplorar={abrirExplorar}
            explorando={enExplorar}
          />
        </div>
        <div className="flex-1 md:hidden" />
        <button
          type="button"
          onClick={() => cambiarPreferencias({ tema: modoOscuro ? 'kort' : 'oscuro' })}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-[var(--sombra)] transition-colors hover:border-primary hover:text-primary"
          aria-label={modoOscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}
          title={modoOscuro ? 'Modo claro' : 'Modo oscuro'}
        >
          {modoOscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <MenuUsuario usuario={yo} onAjustes={() => setModal('ajustes')} onSalir={salir} />
      </header>

      {/* Menú del celular: Inicio, servidores y el panel lateral */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="aparecer-fundido absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          />
          <aside className="panel aparecer-izquierda absolute inset-y-3 left-3 flex w-80 max-w-[85vw] flex-col overflow-hidden" aria-label="Navegación">
            <div className="flex items-center justify-between gap-2 border-b border-border p-3">
              {botonInicio}
              <BuscadorServidores servidores={servidores ?? []} onSeleccionar={seleccionarServidor} />
          <AccionesServidor
            onCrear={() => setModal('crearServidor')}
            onUnirme={() => setModal('unirme')}
            onExplorar={abrirExplorar}
            explorando={enExplorar}
          />
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-elevated"
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="border-b border-border p-3">
              <ServerSelector
                servidores={servidores}
                seleccionadoId={servidor?.id}
                miId={yo?.id}
                cargando={cargandoServidores || !yo}
                onSeleccionar={seleccionarServidor}
                onReordenar={reordenarServidores}
              />
            </div>
            {mostrarInicio && <div className="min-h-0 flex-1">{lateral}</div>}
          </aside>
        </div>
      )}

      {/* Te están llamando por mensaje directo */}
      {yo && (
        <LlamadasEntrantes
          voz={voz}
          onAtender={(p) => {
            abrirDirecto({ id: p.usuario_id, username: p.username, avatar_url: null, bio: null })
            setLlamadaDmAbierta(p.usuario_id)
            voz.entrar({ id: p.usuario_id, nombre: p.username, directo: true }, yo.id)
          }}
        />
      )}

      {/* Mientras estás en una llamada (aunque mires otra cosa) */}
      <div className="fixed bottom-5 left-5 z-30 w-72 max-w-[calc(100vw-2.5rem)] [&>*]:shadow-[var(--sombra)] [&>*]:backdrop-blur">
        {/* Si ya estás mirando esa llamada, los controles están en pantalla: la barrita sobra. */}
        {!(!mostrarInicio && !herramienta && canal?.tipo === 'voz' && mismaSala(voz.canal, { id: canal.id, nombre: canal.nombre })) &&
          !(mostrarInicio && seleccionInicio.tipo === 'dm' && llamadaDmAbierta === seleccionInicio.usuario.id && voz.canal?.directo) && (
            <VozBar voz={voz} />
          )}
      </div>

      {/* Paneles flotantes */}
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        {/* Pestañas del servidor en columna (si el usuario lo eligió) */}
        {!mostrarInicio && servidor && disposicion === 'vertical' && !ampliada && (
          <aside className="panel hidden w-64 shrink-0 flex-col overflow-hidden md:flex" aria-label={`Secciones de ${servidor.nombre}`}>
            <SeccionesServidor
              servidorId={servidor.id}
              canales={canales}
              canalId={canal?.id}
              vista={herramienta}
              permisos={permisos}
              orientacion="vertical"
              onCanal={seleccionarCanal}
              onVista={seleccionarHerramienta}
              onCrearCanal={() => setModal('crearCanal')}
              onCanalesCambiados={() => mutateCanales()}
            />
          </aside>
        )}
        {mostrarInicio && (
          <aside className="panel hidden w-72 shrink-0 flex-col overflow-hidden md:flex" aria-label="Inicio">
            {lateral}
          </aside>
        )}

        <main className="panel flex min-w-0 flex-1 flex-col overflow-hidden">
          {mostrarInicio || enExplorar ? (
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">{encabezado}</div>
          ) : ampliada ? null : (
            encabezado
          )}
          {/* La clave cambia al ir a otra pestaña/canal/vista: así el contenido nuevo aparece animado. */}
          <div key={claveVista} className="aparecer flex min-h-0 flex-1 flex-col">
            {contenido}
          </div>
        </main>

        {!mostrarInicio && servidor && panelContenido && !ampliada && (
          <>
            <div className="panel aparecer-lado hidden shrink-0 overflow-hidden lg:block">{panelContenido}</div>
            <div className="panel aparecer-lado fixed inset-y-3 right-3 z-30 overflow-hidden lg:hidden">{panelContenido}</div>
          </>
        )}
      </div>

      <CrearServidorModal abierto={modal === 'crearServidor'} onCerrar={() => setModal(null)} onCreado={agregarServidor} />
      <UnirmeModal abierto={modal === 'unirme'} onCerrar={() => setModal(null)} onUnido={agregarServidor} />
      {servidor && (
        <>
          <CrearCanalModal
            abierto={modal === 'crearCanal'}
            onCerrar={() => setModal(null)}
            servidorId={servidor.id}
            onCreado={(c) => {
              mutateCanales((cur) => [...(cur ?? []), c], { revalidate: true })
              seleccionarCanal(c.id)
            }}
          />
          <InvitarModal abierto={modal === 'invitar'} onCerrar={() => setModal(null)} servidor={servidor} />
          {modal === 'configuracion' && yo && (
            <ConfiguracionServidor
              servidor={servidor}
              permisos={permisos}
              miId={yo.id}
              canales={canales ?? []}
              roles={roles ?? []}
              miembros={miembros ?? []}
              onCerrar={() => setModal(null)}
              onActualizar={refrescarTodo}
              onSalio={alSalirDelServidor}
            />
          )}
        </>
      )}
      {modal === 'ajustes' && yo && (
        <AjustesUsuario
          usuario={yo}
          apariencia={
            preferencias && (
              <AparienciaTab inicial={preferencias} onGuardado={(p) => mutatePreferencias(p, { revalidate: false })} />
            )
          }
          wrapped={<WrappedTab />}
          onCerrar={() => setModal(null)}
          onActualizado={() => {
            mutateYo()
            mutateMiembros()
          }}
        />
      )}
      {wrappedAbierto && <WrappedHistoria anio={new Date().getFullYear()} onCerrar={() => setWrappedAbierto(false)} />}
      <PerfilModal
        usuarioId={perfilAbierto}
        onCerrar={() => setPerfilAbierto(null)}
        onMensaje={abrirDirecto}
        extra={(perfil) =>
          yo && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground">Publicaciones</p>
              <div className="scrollbar-thin -mx-2 max-h-96 overflow-y-auto px-2">
                <PublicacionesLista
                  clave={`perfil-${perfil.id}`}
                  cargar={(antesDe) => getPublicacionesDePerfil(perfil.id, antesDe)}
                  yo={yo}
                  permitirPublicar={false}
                  vacio={perfil.relacion === 'yo' ? 'Todavía no publicaste nada.' : `${perfil.username} todavía no publicó nada.`}
                />
              </div>
            </div>
          )
        }
      />
    </div>
  )
}

function BotonPanel({
  icono: Icono,
  etiqueta,
  activo,
  onClick,
}: {
  icono: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  etiqueta: string
  activo: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={etiqueta}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
        activo ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
      )}
    >
      <Icono className="size-4" aria-hidden />
      <span className="hidden xl:inline">{etiqueta}</span>
    </button>
  )
}
