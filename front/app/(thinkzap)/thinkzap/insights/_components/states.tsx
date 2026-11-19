'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'

/**
 * `computing`: a API respondeu que o painel está sendo calculado (primeira
 * abertura, ou cache frio). A tela consulta de novo sozinha; o aviso explica
 * por que demora e que não precisa recarregar.
 */
export function LoadingBox({ computing = false }: { computing?: boolean }) {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <div
      className="flex min-h-[30vh] flex-col items-center justify-center gap-2 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="animate-pulse text-sm text-muted-foreground">
          {computing ? t('state.computing') : t('state.loading')}
        </span>
      </div>
      {computing ? (
        <p className="max-w-md text-xs text-muted-foreground">
          {t('state.computingHint')}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Aviso de que o painel que está na tela vai ser trocado. Ao mudar o filtro, o
 * painel anterior fica visível (esmaecido) até o novo chegar, e com o cálculo em
 * segundo plano isso pode levar minutos: só esmaecer não diz que algo está
 * acontecendo. `computing` = a API respondeu que está calculando.
 */
export function RefreshingBar({ computing = false }: { computing?: boolean }) {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm text-muted-foreground"
    >
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="font-medium text-foreground">
        {computing ? t('state.computing') : t('state.updating')}
      </span>
      {computing ? (
        <span className="text-xs">{t('state.computingHint')}</span>
      ) : null}
    </div>
  )
}

/**
 * A mensagem vem pronta da API (`{ error }`) e entra como texto. Com
 * `onRetry`, oferece tentar de novo (a falha do cálculo é passageira: a
 * abertura seguinte calcula outra vez).
 */
export function ErrorBox({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
        >
          {t('state.retry')}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Aviso de conversas cujas mensagens não puderam ser lidas agora (limite da
 * Vibe API). Os indicadores que dependem de mensagem as contam sem esses dados.
 */
export function IncompleteBanner({ count }: { count: number }) {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <p
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
    >
      {t('incomplete.banner', { count })}
    </p>
  )
}

/**
 * Aviso discreto do modo enxuto: sem a chave Vibecode, o painel usa o REST
 * clássico do Bitrix e alguns blocos (spam, motivos, notas, operadores ao
 * vivo) não têm de onde vir.
 */
export function LeanBanner() {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <p className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
      {t('lean.banner')}{' '}
      <Link
        href="/thinkzap/administracao"
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        {t('lean.link')}
      </Link>
    </p>
  )
}

/**
 * Aviso só para admin: a chave Vibecode cadastrada deixou de funcionar e o
 * painel caiu para o modo enxuto. O pai só renderiza para admin; quem não é
 * admin nem busca o status, então nenhum detalhe da chave chega a ele.
 */
export function KeyRevokedBanner({
  problem = 'revoked',
}: {
  problem?: 'revoked' | 'unreadable'
}) {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <p
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
    >
      {t(problem === 'unreadable' ? 'full.keyUnreadable' : 'full.keyRevoked')}{' '}
      <Link
        href="/thinkzap/administracao"
        className="font-medium underline-offset-2 hover:underline"
      >
        {t('lean.link')}
      </Link>
    </p>
  )
}
