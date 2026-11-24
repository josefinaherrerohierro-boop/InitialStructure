'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR, { SWRConfig } from 'swr'
import { AtSign, Hash, House, Images, Lock, Menu, Newspaper, Pin, Plus, Search, Ticket, Users, Volume2, X } from 'lucide-react'
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
  getPublicacionesDeServidor,
  getServidoresDeUsuario,
  getToken,
  mensajeDeError,
  ordenarServidores,
  type Servidor,
  type UsuarioResumen,
} from '@/lib/api'
import { aplicarApariencia, CLAVE_APARIENCIA, PREFERENCIAS_POR_DEFECTO } from '@/lib/apariencia'
import { calcularPermisos } from '@/lib/kort'
import { useVoz } from '@/lib/use-voz'
import { cn } from '@/lib/utils'
import { AjustesUsuario } from './ajustes/ajustes-usuario'
import { AparienciaTab } from './ajustes/apariencia-tab'
import { CalendarioView } from './calendario'
import { ChannelList, HERRAMIENTAS, type Herramienta } from './channel-list'
import { ConfiguracionServidor } from './config/configuracion-servidor'
import { ChatPanel, DirectoPanel } from './chat-panel'
import { EmptyState } from './empty-state'
import { EstadosBarra } from './estados'
import { AmigosView, InicioSidebar, usePendientesInicio, type SeleccionInicio } from './inicio'
import { MembersPanel } from './members-panel'
import { CrearCanalModal, CrearServidorModal, InvitarModal, UnirmeModal } from './modals'
import { BusquedaPanel, FijadosPanel, MultimediaPanel } from './paneles-chat'
import { PerfilModal } from './perfil-modal'
import { PublicacionesLista } from './publicaciones'
import { ScoreboardView } from './scoreboard'
import { TareasView } from './tareas'
import { ServerSelector } from './server-selector'
import { useToast } from './toast-provider'
import { Avatar, Boton, Logo } from './ui'
import { UserCard } from './user-card'
import { VoicePanel, VozBar } from './voice-panel'

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
  const [seleccionInicio, setSeleccionInicio] = useState<SeleccionInicio>({ tipo: 'amigos' })
  const [canalPorServidor, setCanalPorServidor] = useState<Record<number, number>>({})
  // Si está elegida una herramienta (calendario, tareas...) se muestra en vez del canal.
  const [herramientaPorServidor, setHerramientaPorServidor] = useState<Record<number, Herramienta | null>>({})
  const [panel, setPanel] = useState<PanelDerecho>('miembros')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [perfilAbierto, setPerfilAbierto] = useState<number | null>(null)
  // Chat de voz: vive acá para que la llamada siga aunque mires otro canal.
  const voz = useVoz()

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
  const {
    data: servidores,
    isLoading: cargandoServidores,
    mutate: mutateServidores,
  } = useSWR(yo ? ['servidores', yo.id] : null, () => getServidoresDeUsuario(yo!.id))
  const pendientesInicio = usePendientesInicio(!!yo && !enInicio)

  const mostrarInicio = enInicio

  const servidor = useMemo(
    () => (mostrarInicio ? undefined : (servidores?.find((s) => s.id === servidorElegido) ?? servidores?.[0])),
    [servidores, servidorElegido, mostrarInicio],
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

  const herramienta = servidor ? (herramientaPorServidor[servidor.id] ?? null) : null

  const permisos = useMemo(() => calcularPermisos(servidor, yo?.id, miembros, roles), [servidor, yo, miembros, roles])

  const canal = useMemo(() => {
    if (!servidor || !canales) return undefined
    const elegido = canalPorServidor[servidor.id]
    return canales.find((c) => c.id === elegido) ?? canales.find((c) => c.tipo === 'texto') ?? canales[0]
  }, [servidor, canales, canalPorServidor])

  function seleccionarServidor(id: number) {
    setEnInicio(false)
    setServidorElegido(id)
    setMenuAbierto(false)
    router.replace(`/app?servidor=${id}`, { scroll: false })
  }

  function irAInicio(seleccion?: SeleccionInicio) {
    setEnInicio(true)
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

  function seleccionarHerramienta(h: Herramienta) {
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

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between px-2 pt-1">
        <Logo className="text-2xl" />
        <button
          type="button"
          onClick={() => setMenuAbierto(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground md:hidden"
          aria-label="Cerrar menú"
        >
          <X className="size-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => irAInicio()}
        aria-current={mostrarInicio ? 'true' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors',
          mostrarInicio ? 'bg-primary/12 font-medium text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <House className="size-4" aria-hidden />
        </span>
        Inicio
        {pendientesInicio > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
            {pendientesInicio > 99 ? '99+' : pendientesInicio}
          </span>
        )}
      </button>

      <ServerSelector
        servidores={servidores}
        seleccionadoId={servidor?.id}
        miId={yo?.id}
        cargando={cargandoServidores || !yo}
        onSeleccionar={seleccionarServidor}
        onReordenar={reordenarServidores}
      />

      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" className="h-9 px-2 text-xs" onClick={() => setModal('crearServidor')}>
          <Plus className="size-3.5" aria-hidden />
          Crear servidor
        </Boton>
        <Boton variante="secundario" className="h-9 px-2 text-xs" onClick={() => setModal('unirme')}>
          <Ticket className="size-3.5" aria-hidden />
          Unirme con código
        </Boton>
      </div>

      <div className="h-px bg-border" aria-hidden />

      {mostrarInicio ? (
        <InicioSidebar
          seleccion={seleccionInicio}
          onSeleccionar={(s) => {
            setSeleccionInicio(s)
            setMenuAbierto(false)
          }}
        />
      ) : servidor ? (
        <ChannelList
          servidor={servidor}
          canales={canales}
          cargando={cargandoCanales}
          seleccionadoId={canal?.id}
          herramienta={herramienta}
          permisos={permisos}
          onSeleccionar={seleccionarCanal}
          onHerramienta={seleccionarHerramienta}
          onCrearCanal={() => setModal('crearCanal')}
          onInvitar={() => setModal('invitar')}
          onConfigurar={() => setModal('configuracion')}
        />
      ) : (
        <div className="flex-1" />
      )}

      <VozBar voz={voz} />
      <UserCard usuario={yo} onSalir={salir} onCuenta={() => setModal('ajustes')} />
    </div>
  )

  // ---------- Encabezado y contenido principal ----------
  let encabezado: React.ReactNode
  let contenido: React.ReactNode

  if (mostrarInicio) {
    if (seleccionInicio.tipo === 'dm') {
      const u = seleccionInicio.usuario
      encabezado = (
        <button type="button" onClick={() => setPerfilAbierto(u.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <AtSign className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Avatar nombre={u.username} url={u.avatar_url} tamanio="sm" />
          <h1 className="truncate font-semibold hover:underline">{u.username}</h1>
        </button>
      )
      contenido = yo && <DirectoPanel key={u.id} usuario={u} yo={yo} onVerPerfil={setPerfilAbierto} />
    } else if (seleccionInicio.tipo === 'feed') {
      encabezado = (
        <div className="flex flex-1 items-center gap-2">
          <Newspaper className="size-4 text-muted-foreground" aria-hidden />
          <h1 className="font-semibold">Publicaciones y estados</h1>
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
          <h1 className="font-semibold">Amigos</h1>
        </div>
      )
      contenido = <AmigosView onMensaje={abrirDirecto} onVerPerfil={setPerfilAbierto} />
    }
  } else {
    encabezado = (
      <>
        {herramienta ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <IconoHerramienta herramienta={herramienta} />
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">· {servidor?.nombre}</span>
          </div>
        ) : canal ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {canal.tipo === 'voz' ? (
              <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <Hash className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <h1 className="truncate font-semibold">{canal.nombre}</h1>
            {canal.solo_lectura && (
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-elevated px-1.5 py-0.5 text-[11px] text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                Solo lectura
              </span>
            )}
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">· {servidor?.nombre}</span>
          </div>
        ) : (
          <h1 className="flex-1 truncate font-semibold">{servidor?.nombre ?? 'Kort'}</h1>
        )}
        {servidor && (
          <div className="flex shrink-0 items-center gap-0.5">
            {canal?.tipo === 'texto' && !herramienta && (
              <BotonPanel icono={Pin} etiqueta="Fijados" activo={panel === 'fijados'} onClick={() => alternarPanel('fijados')} />
            )}
            <BotonPanel icono={Search} etiqueta="Buscar" activo={panel === 'buscar'} onClick={() => alternarPanel('buscar')} />
            <BotonPanel
              icono={Images}
              etiqueta="Multimedia"
              activo={panel === 'multimedia'}
              onClick={() => alternarPanel('multimedia')}
            />
            <BotonPanel icono={Users} etiqueta="Miembros" activo={panel === 'miembros'} onClick={() => alternarPanel('miembros')} />
          </div>
        )}
      </>
    )
    contenido = sinServidores ? (
      <EmptyState onCrear={() => setModal('crearServidor')} onUnirme={() => setModal('unirme')} />
    ) : herramienta && servidor && yo ? (
      herramienta === 'publicaciones' ? (
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
        <CalendarioView key={servidor.id} servidorId={servidor.id} miId={yo.id} permisos={permisos} />
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
        <VoicePanel canal={canal} yo={yo} voz={voz} />
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
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-surface md:block" aria-label="Navegación">
        {sidebar}
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          />
          <aside className="relative h-full w-80 max-w-[85vw] border-r border-border bg-surface" aria-label="Navegación">
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          {encabezado}
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">{contenido}</div>

          {!mostrarInicio && servidor && panelContenido && (
            <>
              <div className="hidden lg:block">{panelContenido}</div>
              <div className="fixed inset-y-0 right-0 z-30 shadow-2xl shadow-black/50 lg:hidden">{panelContenido}</div>
            </>
          )}
        </div>
      </main>

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
          onCerrar={() => setModal(null)}
          onActualizado={() => {
            mutateYo()
            mutateMiembros()
          }}
        />
      )}
      <PerfilModal
        usuarioId={perfilAbierto}
        onCerrar={() => setPerfilAbierto(null)}
        onMensaje={abrirDirecto}
        extra={(perfil) =>
          yo && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Publicaciones</p>
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

function IconoHerramienta({ herramienta }: { herramienta: Herramienta }) {
  const h = HERRAMIENTAS.find((x) => x.id === herramienta)!
  return (
    <>
      <h.Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <h1 className="truncate font-semibold">{h.nombre}</h1>
    </>
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
