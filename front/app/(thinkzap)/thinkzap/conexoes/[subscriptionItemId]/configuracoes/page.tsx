'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSubscriptionLines } from '@/shared/aplication/subscription-items'
import type { LineConnection } from '@/app/hooks/use-line-api'
import { ConexaoTab } from '../../../_components/configuracoes/conexao-tab'
import { AjustesTab } from '../../../_components/configuracoes/ajustes-tab'
import { GruposTab } from '../../../_components/configuracoes/grupos-tab'
import { ConfiguracoesOficial } from '../../../_components/configuracoes/oficial/configuracoes-oficial'

type TabId = 'conexao' | 'grupos' | 'ajustes'

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
   * internos na outra.
   *
   * Sem a aba Ajustes, a linha oficial não tinha onde ser vinculada a um canal
   * aberto — e sem vínculo a mensagem não chega ao CRM. Grupos ficam fora: são
   * recurso de Z-API, a HubMessage não expõe.
   */
  if (linha.provider === 'HUBMESSAGE') {
    const oficialTabs: Array<{ id: TabId; label: string }> = [
      { id: 'conexao', label: t('tabs.conexao') },
      { id: 'ajustes', label: t('tabs.ajustes') },
    ]

    return (
      <Shell titulo={linha.name} provider={t('provider.oficial')}>
        <Tabs
          tabs={oficialTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel={t('tabsAriaLabel')}
        />

        <div className="mt-6">
          {activeTab === 'ajustes' ? (
            <AjustesTab itemId={linha.id} />
          ) : (
            <ConfiguracoesOficial itemId={linha.id} />
          )}
        </div>
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
  ]

  return (
    <Shell
      titulo={connection?.name || linha.name}
      provider={t('provider.naoOficial')}
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
        onChange={setActiveTab}
        ariaLabel={t('tabsAriaLabel')}
      />

      {/*
        Abas por estado local, não por sub-rota: o cabeçalho depende do estado da
        conexão, e sub-rota remontaria a casca a cada troca de aba.
      */}
      <div className="mt-6">
        {activeTab === 'conexao' && (
          <ConexaoTab itemId={linha.id} onConnectionChange={setConnection} />
        )}
        {activeTab === 'grupos' && (
          <GruposTab
            itemId={linha.id}
            isConnected={connection?.connected === true}
          />
        )}
        {activeTab === 'ajustes' && <AjustesTab itemId={linha.id} />}
      </div>
    </Shell>
  )
}

function Shell({
  titulo,
  provider,
  status,
  children,
}: {
  titulo?: string
  provider?: string
  status?: { label: string; tone: 'ok' | 'warn' }
  children: React.ReactNode
}) {
  const { t } = useTranslation('thinkzap/configuracoes/page')

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/thinkzap/conexoes"
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
