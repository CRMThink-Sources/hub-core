'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { SubscriptionLine } from '@/shared/aplication/subscription-items'

type Props = {
  linha: SubscriptionLine
  showBorderBottom: boolean
}

/**
 * Uma linha contratada — item de assinatura de `GET /api/application/me`.
 *
 * Não há mais conector/instância por trás desta linha, então **não** há status de
 * conexão ao vivo, canal vinculado nem telefone aqui: nenhum desses dados vive no
 * item. O status exibido é o do item (cobrança), não o da conexão com o WhatsApp —
 * conexão, grupos e ajustes ficam na tela de configuração, para onde a linha leva.
 */
export function ConexaoRow({ linha, showBorderBottom }: Props) {
  const { t } = useTranslation('thinkzap/conexoes/conexao-row')
  const router = useRouter()
  const href = `/thinkzap/conexoes/${encodeURIComponent(linha.id)}/configuracoes`

  const isAtivo = linha.status === 'active'
  const statusClass = isAtivo
    ? 'bg-primary/10 text-primary'
    : 'bg-destructive/10 text-destructive'
  const statusText = isAtivo ? t('status.ativo') : t('status.cancelado')

  const isOficial = linha.provider === 'HUBMESSAGE'
  const providerClass = isOficial
    ? 'border-primary/30 bg-primary/10 text-primary'
    : 'border-border bg-muted text-muted-foreground'
  const providerText = isOficial
    ? t('provider.oficial')
    : t('provider.naoOficial')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(href)
        }
      }}
      className={`cursor-pointer p-4 transition-colors hover:bg-accent ${
        showBorderBottom ? 'border-b border-border' : ''
      }`}
      data-line-id={linha.id}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-left text-base font-semibold text-foreground transition-colors hover:text-primary">
              {linha.name || t('semNome')}
            </span>
            {linha.provider !== 'NONE' && (
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${providerClass}`}
              >
                {providerText}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="truncate">
              {linha.planName || t('semPlano')}
              {linha.providerRef ? ` · ${linha.providerRef}` : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-1 justify-center">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusText}
          </span>
        </div>
      </div>
    </div>
  )
}
