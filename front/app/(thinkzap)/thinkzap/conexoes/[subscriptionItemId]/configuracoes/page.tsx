'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSubscriptionLines } from '@/shared/aplication/subscription-items'
import type { LineConnection } from '@/app/hooks/use-line-api'
import { ConexaoTab } from '../../../_components/configuracoes/conexao-tab'
import { AjustesTab } from '../../../_components/configuracoes/ajustes-tab'
import { GruposTab } from '../../../_components/configuracoes/grupos-tab'
import { ConexaoOficialTab } from '../../../_components/configuracoes/oficial/conexao-oficial-tab'
import { TemplatesTab } from '../../../_components/configuracoes/oficial/templates-tab'
import { CampanhaSmsTab } from '../../../_components/configuracoes/campanha-sms-tab'
import { ConfirmModal } from '../../../_components/configuracoes/confirm-modal'

type TabId = 'conexao' | 'grupos' | 'ajustes' | 'templates' | 'campanha'

/**
 * Configuração de uma linha, identificada pelo **id do item de assinatura**.
 *
 * A linha vem do `AplicationProvider` já montado no layout do thinkzap — nenhuma
 * requisição nova só para saber qual linha é, e os estados de carregamento e erro
 * do contexto viram estados desta tela em vez de virarem "não encontrada".
 */
export default function ConfiguracoesLinhaPage() {
  const params = useParams()
  const itemId = params.subscriptionItemId as string
  const { t } = useTranslation('thinkzap/configuracoes/page')
  const { state } = useAplicationContext()

  const [activeTab, setActiveTab] = useState<TabId>('conexao')
  /** Vem da aba Conexão para o cabeçalho não precisar da própria leitura. */
  const [connection, setConnection] = useState<LineConnection | null>(null)
  const router = useRouter()

  /**
   * Alteração não salva em Ajustes. Trocar de aba desmonta a aba — e o que foi
   * digitado some sem aviso —, então a troca passa por aqui antes.
   */
  const [ajustesDirty, setAjustesDirty] = useState(false)
  /** Para onde o usuário queria ir quando a confirmação abriu. */
  const [destinoPendente, setDestinoPendente] = useState<
    TabId | 'voltar' | null
  >(null)

  const temPendencia = activeTab === 'ajustes' && ajustesDirty

  function requestTab(id: TabId) {
    if (temPendencia && id !== 'ajustes') {
      setDestinoPendente(id)
      return
    }
    setActiveTab(id)
  }

  /**
   * "Voltar para conexões" é navegação client-side: `beforeunload` não dispara, e
   * sem esta guarda o link seria a saída silenciosa que a da aba tenta evitar.
   */
  function handleVoltar(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!temPendencia) return
    event.preventDefault()
    setDestinoPendente('voltar')
  }

  function confirmarSaida() {
    const destino = destinoPendente
    setDestinoPendente(null)
    setAjustesDirty(false)

    if (destino === 'voltar') router.push('/thinkzap/conexoes')
    else if (destino !== null) setActiveTab(destino)
  }

  const confirmacaoSaida = (
    <ConfirmModal
      isOpen={destinoPendente !== null}
      title={t('sairSemSalvar.titulo')}
      message={t('sairSemSalvar.descricao')}
      confirmLabel={t('sairSemSalvar.confirmar')}
      cancelLabel={t('sairSemSalvar.cancelar')}
      onConfirm={confirmarSaida}
      onClose={() => setDestinoPendente(null)}
    />
  )

  const linha = useMemo(() => {
    if (state.status !== 'ready') return null
    return (
      listSubscriptionLines(state.subscriptions).find(l => l.id === itemId) ??
      null
    )
  }, [state, itemId])

  if (state.status === 'loading') {
    return (
      <Shell>
        <div className="flex items-center gap-2 py-12">
          <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="text-sm text-muted-foreground">
            {t('carregando')}
          </span>
        </div>
      </Shell>
    )
  }

  // Falha de contexto não vira "linha não encontrada": são causas diferentes.
  if (state.status !== 'ready') {
    return (
      <Shell>
        <Aviso
          title={t('erroContextoTitulo')}
          message={
            state.status === 'error'
              ? state.message
              : state.status === 'not-found'
                ? t('instalacaoNaoEncontrada')
                : t('sessaoExpirada')
          }
        />
      </Shell>
    )
  }

  if (!linha) {
    return (
      <Shell>
        <Aviso
          title={t('linhaNaoEncontrada')}
          message={t('linhaNaoEncontradaHint')}
        />
      </Shell>
    )
  }

  /**
   * Linha oficial tem a **mesma casca** da não-oficial: conexão numa aba, ajustes
   * internos na outra, e Templates no lugar de Grupos.
   *
   * Templates tem aba própria porque Conexão passou a existir de verdade: antes a
   * aba rotulada "Conexão" mostrava Templates dentro de um invólucro com a própria
   * navegação, o que agora seria uma nav dentro de outra.
   *
   * Grupos ficam fora: são recurso de Z-API, a HubMessage não expõe. Ajustes
   * ficam porque é lá que a linha oficial é vinculada a um canal aberto — sem
   * vínculo a mensagem não chega ao CRM.
   */
  if (linha.provider === 'HUBMESSAGE') {
    const oficialTabs: Array<{ id: TabId; label: string }> = [
      { id: 'conexao', label: t('tabs.conexao') },
      { id: 'templates', label: t('tabs.templates') },
      { id: 'ajustes', label: t('tabs.ajustes') },
      { id: 'campanha', label: t('tabs.campanha') },
    ]

    return (
      <Shell
        titulo={linha.name}
        provider={t('provider.oficial')}
        onVoltar={handleVoltar}
        status={
          connection === null
            ? undefined
            : connection.connected
              ? { label: t('status.conectada'), tone: 'ok' }
              : { label: t('status.desconectada'), tone: 'warn' }
        }
      >
        <Tabs
          tabs={oficialTabs}
          activeTab={activeTab}
          onChange={requestTab}
          ariaLabel={t('tabsAriaLabel')}
        />

        <div className="mt-6">
          {activeTab === 'templates' && <TemplatesTab itemId={linha.id} />}
          {activeTab === 'ajustes' && (
            <AjustesTab itemId={linha.id} onDirtyChange={setAjustesDirty} />
          )}
          {activeTab === 'campanha' && <CampanhaSmsTab itemId={linha.id} />}
          {/**
           * `conexao` é o default e também o destino de qualquer aba que não
           * pertença à linha oficial — `grupos` sobrevive na troca de linha.
           */}
          {activeTab !== 'templates' &&
            activeTab !== 'ajustes' &&
            activeTab !== 'campanha' && (
              <ConexaoOficialTab
                itemId={linha.id}
                /**
                 * Nunca nulo aqui: item `HUBMESSAGE` sem canal é recusado na leitura
                 * do contexto — sem canal não há recurso no provider.
                 */
                channelId={linha.providerRef ?? ''}
                onConnectionChange={setConnection}
              />
            )}
        </div>

        {confirmacaoSaida}
      </Shell>
    )
  }

  if (linha.provider === 'NONE') {
    return (
      <Shell titulo={linha.name}>
        <Aviso title={t('semProviderTitulo')} message={t('semProviderHint')} />
      </Shell>
    )
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'conexao', label: t('tabs.conexao') },
    { id: 'grupos', label: t('tabs.grupos') },
    { id: 'ajustes', label: t('tabs.ajustes') },
    { id: 'campanha', label: t('tabs.campanha') },
  ]

  return (
    <Shell
      titulo={linha.name}
      /**
       * O aparelho é informação secundária, não o título.
       *
       * `connection.name` é o nome de perfil da conta do WhatsApp conectada —
       * responde a "qual número está nesta linha", não "como esta linha se chama".
       * Enquanto ele era o título, com aparelho conectado (o caso normal) ele
       * apagava o nome da linha, inclusive um que o cliente acabara de digitar.
       */
      subtitulo={
        connection?.name ? t('aparelho', { nome: connection.name }) : undefined
      }
      provider={t('provider.naoOficial')}
      onVoltar={handleVoltar}
      status={
        connection === null
          ? undefined
          : connection.connected
            ? { label: t('status.conectada'), tone: 'ok' }
            : { label: t('status.desconectada'), tone: 'warn' }
      }
    >
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={requestTab}
        ariaLabel={t('tabsAriaLabel')}
      />

      {/*
        Abas por estado local, não por sub-rota: o cabeçalho depende do estado da
        conexão, e sub-rota remontaria a casca a cada troca de aba.
      */}
      <div className="mt-6">
        {activeTab === 'conexao' && (
          <ConexaoTab
            itemId={linha.id}
            /* Linha `ZAPI`: o `providerRef` é o `instanceId`, que nomeia a sala do socket. */
            providerRef={linha.providerRef}
            onConnectionChange={setConnection}
          />
        )}
        {activeTab === 'grupos' && (
          <GruposTab
            itemId={linha.id}
            isConnected={connection?.connected === true}
          />
        )}
        {activeTab === 'ajustes' && (
          <AjustesTab
            itemId={linha.id}
            onDirtyChange={setAjustesDirty}
            provider="ZAPI"
          />
        )}
        {activeTab === 'campanha' && <CampanhaSmsTab itemId={linha.id} />}
      </div>

      {confirmacaoSaida}
    </Shell>
  )
}

function Shell({
  titulo,
  subtitulo,
  provider,
  status,
  onVoltar,
  children,
}: {
  titulo?: string
  /** Informação secundária da linha — hoje, o aparelho conectado na Z-API. */
  subtitulo?: string
  provider?: string
  status?: { label: string; tone: 'ok' | 'warn' }
  /** Pode cancelar a navegação (`preventDefault`) — ex.: alteração não salva. */
  onVoltar?: (event: React.MouseEvent<HTMLAnchorElement>) => void
  children: React.ReactNode
}) {
  const { t } = useTranslation('thinkzap/configuracoes/page')

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/thinkzap/conexoes"
          onClick={onVoltar}
          className="w-fit text-sm text-primary hover:underline"
        >
          ← {t('voltar')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {titulo || t('pageTitle')}
          </h1>
          {provider && (
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {provider}
            </span>
          )}
          {status && (
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                status.tone === 'ok'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {status.label}
            </span>
          )}
        </div>
        {subtitulo && (
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        )}
      </header>

      {children}
    </div>
  )
}

function Aviso({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  )
}

/**
 * Navegação por abas, compartilhada entre a linha Z-API e a oficial.
 *
 * Estado local, não sub-rota: o cabeçalho da casca depende do estado da conexão, e
 * sub-rota remontaria a casca a cada troca de aba.
 */
function Tabs({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
}: {
  tabs: Array<{ id: TabId; label: string }>
  activeTab: TabId
  onChange: (id: TabId) => void
  ariaLabel: string
}) {
  return (
    <nav className="flex gap-1 border-b border-border" aria-label={ariaLabel}>
      {tabs.map(tab => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(tab.id)}
            className={`relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
              active
                ? 'bg-card font-semibold text-primary'
                : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {tab.label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
