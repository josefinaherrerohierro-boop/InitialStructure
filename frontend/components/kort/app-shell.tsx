'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR, { SWRConfig } from 'swr'
import { Hash, Lock, Menu, Plus, Ticket, Users, Volume2, X } from 'lucide-react'
import {
  ApiError,
  clearToken,
  getCanales,
  getMe,
  getMiembros,
  getRoles,
  getServidoresDeUsuario,
  getToken,
  mensajeDeError,
  type Servidor,
} from '@/lib/api'
import { calcularPermisos } from '@/lib/kort'
import { cn } from '@/lib/utils'
import { ChannelList } from './channel-list'
import { ConfiguracionServidor } from './config/configuracion-servidor'
import { CuentaModal } from './cuenta-modal'
import { ChatPanel } from './chat-panel'
import { EmptyState } from './empty-state'
import { MembersPanel } from './members-panel'
import { CrearCanalModal, CrearServidorModal, InvitarModal, UnirmeModal } from './modals'
import { ServerSelector } from './server-selector'
import { useToast } from './toast-provider'
import { Boton, Logo } from './ui'
import { UserCard } from './user-card'
import { VoicePanel } from './voice-panel'

type ModalAbierto = 'crearServidor' | 'unirme' | 'crearCanal' | 'invitar' | 'configuracion' | 'cuenta' | null

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
  const params = useSearchParams()
  const [listo, setListo] = useState(false)
  const [servidorElegido, setServidorElegido] = useState<number | undefined>(() => {
    const v = Number(params.get('servidor'))
    return Number.isFinite(v) && v > 0 ? v : undefined
  })
  const [canalPorServidor, setCanalPorServidor] = useState<Record<number, number>>({})
  const [miembrosVisibles, setMiembrosVisibles] = useState(true)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [modal, setModal] = useState<ModalAbierto>(null)

  useEffect(() => {
    if (!getToken()) {
      const actual = window.location.pathname + window.location.search
      router.replace(`/login?next=${encodeURIComponent(actual)}`)
      return
    }
    setListo(true)
  }, [router])

  const { data: yo, mutate: mutateYo } = useSWR(listo ? 'me' : null, getMe)
  const {
    data: servidores,
    isLoading: cargandoServidores,
    mutate: mutateServidores,
  } = useSWR(yo ? ['servidores', yo.id] : null, () => getServidoresDeUsuario(yo!.id))

  const servidor = useMemo(
    () => servidores?.find((s) => s.id === servidorElegido) ?? servidores?.[0],
    [servidores, servidorElegido],
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

  const permisos = useMemo(() => calcularPermisos(servidor, yo?.id, miembros, roles), [servidor, yo, miembros, roles])

  const canal = useMemo(() => {
    if (!servidor || !canales) return undefined
    const elegido = canalPorServidor[servidor.id]
    return canales.find((c) => c.id === elegido) ?? canales.find((c) => c.tipo === 'texto') ?? canales[0]
  }, [servidor, canales, canalPorServidor])

  function seleccionarServidor(id: number) {
    setServidorElegido(id)
    setMenuAbierto(false)
    router.replace(`/app?servidor=${id}`, { scroll: false })
  }

  function seleccionarCanal(id: number) {
    if (!servidor) return
    setCanalPorServidor((prev) => ({ ...prev, [servidor.id]: id }))
    setMenuAbierto(false)
  }

  function agregarServidor(s: Servidor) {
    mutateServidores((cur) => (cur?.some((x) => x.id === s.id) ? cur : [...(cur ?? []), s]), { revalidate: true })
    seleccionarServidor(s.id)
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

  const sidebar = (
    <div className="flex h-full flex-col gap-5 p-3">
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

      <ServerSelector
        servidores={servidores}
        seleccionadoId={servidor?.id}
        miId={yo?.id}
        cargando={cargandoServidores || !yo}
        onSeleccionar={seleccionarServidor}
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

      {servidor ? (
        <ChannelList
          servidor={servidor}
          canales={canales}
          cargando={cargandoCanales}
          seleccionadoId={canal?.id}
          permisos={permisos}
          onSeleccionar={seleccionarCanal}
          onCrearCanal={() => setModal('crearCanal')}
          onInvitar={() => setModal('invitar')}
          onConfigurar={() => setModal('configuracion')}
        />
      ) : (
        <div className="flex-1" />
      )}

      <UserCard usuario={yo} onSalir={salir} onCuenta={() => setModal('cuenta')} />
    </div>
  )

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
          {canal ? (
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
            <button
              type="button"
              onClick={() => setMiembrosVisibles((v) => !v)}
              aria-pressed={miembrosVisibles}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                miembrosVisibles ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground',
              )}
            >
              <Users className="size-4" aria-hidden />
              <span className="hidden sm:inline">Miembros</span>
            </button>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {sinServidores ? (
              <EmptyState onCrear={() => setModal('crearServidor')} onUnirme={() => setModal('unirme')} />
            ) : canal && yo ? (
              canal.tipo === 'voz' ? (
                <VoicePanel nombre={canal.nombre} />
              ) : (
                <ChatPanel key={canal.id} canal={canal} yo={yo} permisos={permisos} />
              )
            ) : canales && canales.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Este servidor todavía no tiene canales.
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Logo className="animate-pulse text-3xl opacity-60" />
              </div>
            )}
          </div>

          {servidor && miembrosVisibles && (
            <>
              <div className="hidden lg:block">
                <MembersPanel
                  miembros={miembros}
                  cargando={cargandoMiembros}
                  miId={yo?.id}
                  onCerrar={() => setMiembrosVisibles(false)}
                />
              </div>
              <div className="fixed inset-y-0 right-0 z-30 shadow-2xl shadow-black/50 lg:hidden">
                <MembersPanel
                  miembros={miembros}
                  cargando={cargandoMiembros}
                  miId={yo?.id}
                  onCerrar={() => setMiembrosVisibles(false)}
                />
              </div>
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
      {yo && (
        <CuentaModal
          key={`${yo.id}-${yo.username}-${yo.email}`}
          abierto={modal === 'cuenta'}
          usuario={yo}
          onCerrar={() => setModal(null)}
          onActualizado={() => mutateYo()}
        />
      )}
    </div>
  )
}
