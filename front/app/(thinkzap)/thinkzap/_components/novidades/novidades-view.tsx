'use client'

import { useState } from 'react'
import { CircleAlert, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ThinkzapNovidade } from '../../_lib/get-thinkzap-novidades'
import { NovidadeRow } from './novidade-row'

export type NovidadesTab = 'available' | 'soon'

export type NovidadesState =
  | { status: 'loading' }
  /** `message` só quando há um texto melhor que o genérico (ex.: sessão expirada). */
  | { status: 'error'; message?: string }
  | { status: 'ready'; items: ThinkzapNovidade[] }

type Props = {
  state: NovidadesState
  /** Idioma atual do app; formata as datas dos cards. */
  locale: string
  onRetry: () => void
  /** Aba aberta na montagem; o padrão da spec é "Já disponível". */
  defaultTab?: NovidadesTab
  /** Linha aberta na montagem; o padrão é tudo recolhido. */
  defaultOpenId?: string | null
}

const NAMESPACE = 'thinkzap/novidades/page'

/**
 * Aba Novidades do ThinkZap, sem busca: recebe o estado pronto para o teste
 * renderizar cada caso. A API já entrega a ordem final; aqui só separa por status.
 */
export function NovidadesView({
  state,
  locale,
  onRetry,
  defaultTab = 'available',
  defaultOpenId = null,
}: Props) {
  const { t } = useTranslation(NAMESPACE)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {state.status === 'loading' && <NovidadesLoading />}
      {state.status === 'error' && (
        <NovidadesError message={state.message} onRetry={onRetry} />
      )}
      {state.status === 'ready' && (
        <NovidadesTabs
          items={state.items}
          locale={locale}
          defaultTab={defaultTab}
          defaultOpenId={defaultOpenId}
        />
      )}
    </div>
  )
}

function NovidadesTabs({
  items,
  locale,
  defaultTab,
  defaultOpenId,
}: {
  items: ThinkzapNovidade[]
  locale: string
  defaultTab: NovidadesTab
  defaultOpenId: string | null
}) {
  const { t } = useTranslation(NAMESPACE)
  const [tab, setTab] = useState<NovidadesTab>(defaultTab)
  // Uma linha aberta por vez; trocar de aba fecha a que estava aberta.
  const [openId, setOpenId] = useState<string | null>(defaultOpenId)

  const available = items.filter(item => item.status === 'available')
  const soon = items.filter(item => item.status === 'soon')
  const labels = { available: t('badge.available'), soon: t('badge.soon') }

  return (
    <Tabs
      value={tab}
      onValueChange={value => {
        setTab(value as NovidadesTab)
        setOpenId(null)
      }}
      className="gap-4"
    >
      <TabsList aria-label={t('tabs.label')}>
        <TabsTrigger value="available" className="px-3">
          {t('tabs.available')}
        </TabsTrigger>
        <TabsTrigger value="soon" className="px-3 tabular-nums">
          {t('tabs.soon', { count: soon.length })}
        </TabsTrigger>
      </TabsList>

      {(['available', 'soon'] as const).map(value => {
        const list = value === 'available' ? available : soon
        return (
          <TabsContent key={value} value={value}>
            {list.length === 0 ? (
              <NovidadesEmpty tab={value} />
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
                {list.map(item => (
                  <li key={item.id}>
                    <NovidadeRow
                      update={item}
                      labels={labels}
                      locale={locale}
                      open={openId === item.id}
                      onToggle={() =>
                        setOpenId(current =>
                          current === item.id ? null : item.id,
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

function NovidadesEmpty({ tab }: { tab: NovidadesTab }) {
  const { t } = useTranslation(NAMESPACE)
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-base font-semibold text-foreground">
        {t(`empty.${tab}.title`)}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {t(`empty.${tab}.description`)}
      </p>
    </div>
  )
}

function NovidadesLoading() {
  const { t } = useTranslation(NAMESPACE)
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <div aria-hidden className="h-9 w-64 rounded-lg bg-muted" />
      {[0, 1].map(key => (
        <div
          key={key}
          aria-hidden
          className="flex animate-pulse flex-col gap-3 rounded-xl border border-border bg-card p-5 motion-reduce:animate-none sm:p-6"
        >
          <div className="h-6 w-24 rounded-full bg-muted" />
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function NovidadesError({
  message,
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  const { t } = useTranslation(NAMESPACE)
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <CircleAlert
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-destructive"
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t('error.title')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {message ?? t('error.description')}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        onClick={onRetry}
        className="self-start sm:self-auto"
      >
        <RotateCw aria-hidden />
        {t('error.retry')}
      </Button>
    </div>
  )
}
