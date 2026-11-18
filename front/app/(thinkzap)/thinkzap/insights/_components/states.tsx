'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export function LoadingBox() {
  const { t } = useTranslation('thinkzap/insights')
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-2 py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="animate-pulse text-sm text-muted-foreground">
        {t('state.loading')}
      </span>
    </div>
  )
}

/** A mensagem vem pronta da API (`{ error }`) e entra como texto. */
export function ErrorBox({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
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
