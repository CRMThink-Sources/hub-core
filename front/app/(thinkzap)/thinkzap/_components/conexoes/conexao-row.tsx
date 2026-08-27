'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SubscriptionLine } from '@/shared/aplication/subscription-items'
import type { OfferablePlan } from '@/app/hooks/use-line-subscription'

type Props = {
  linha: SubscriptionLine
  showBorderBottom: boolean
  /**
   * Planos que servem **esta** linha — já filtrados pelo conector dela. Vazio
   * esconde a ação de assinar.
   */
  planos?: OfferablePlan[]
  /**
   * Reserva a coluna de ação mesmo quando **esta** linha não tem plano. A tabela
   * decide, olhando todas as linhas: sem a reserva uniforme, uma linha com botão e
   * outra sem ficariam com colunas de larguras diferentes.
   */
  reservarAcoes?: boolean
  /** Plano em redirecionamento, para desabilitar a ação sem travar a tela. */
  redirecting?: string | null
  onSubscribe?: (planId: string) => void
  /** Exclusão em curso desta linha, para travar o item sem travar a tela. */
  excluindo?: boolean
  onDelete?: () => void
}

/** Igual ao `ACAO_COL` da tabela — cabeçalho, linha com botão e linha sem, todas iguais. */
const ACAO_COL = 'w-56 shrink-0'

/**
 * Uma linha contratada — item de assinatura de `GET /api/application/me`.
 *
 * Não há mais conector/instância por trás desta linha, então **não** há status de
 * conexão ao vivo, canal vinculado nem telefone aqui: nenhum desses dados vive no
 * item. O status exibido é o do item (cobrança), não o da conexão com o WhatsApp —
 * conexão, grupos e ajustes ficam na tela de configuração, para onde a linha leva.
 *
 * A ação de assinar mora aqui, e não num card separado, porque **o que se assina é
 * a linha**: com mais de uma na lista, um botão fora dela não diria qual.
 */
export function ConexaoRow({
  linha,
  showBorderBottom,
  planos = [],
  reservarAcoes = false,
  redirecting = null,
  onSubscribe,
  excluindo = false,
  onDelete,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/conexao-row')
  const router = useRouter()
  const href = `/thinkzap/conexoes/${encodeURIComponent(linha.id)}/configuracoes`

  /** Só é escolha quando há mais de um plano para o mesmo conector. */
  const [planoEscolhido, setPlanoEscolhido] = useState<string>(
    planos[0]?.id ?? '',
  )

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

  const podeAssinar = planos.length > 0 && onSubscribe !== undefined
  const planoAtual = planos.find(p => p.id === planoEscolhido) ?? planos[0]

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

        {/**
         * A célula é reservada sempre que a tabela pede, com ou sem botão dentro —
         * é o que mantém STATUS alinhado com o cabeçalho e as linhas entre si.
         *
         * `stopPropagation` porque a linha inteira é um botão que navega para a
         * configuração: sem isso, assinar levaria o cliente para outra tela no
         * mesmo clique.
         */}
        {reservarAcoes ? (
          <div
            className={`flex items-center justify-end gap-2 ${ACAO_COL}`}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            {podeAssinar && planoAtual ? (
              <>
                {planos.length > 1 ? (
                  <select
                    value={planoEscolhido}
                    onChange={e => setPlanoEscolhido(e.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                    aria-label={t('assinar.escolherPlano')}
                  >
                    {planos.map(plano => (
                      <option key={plano.id} value={plano.id}>
                        {plano.name} · {formatAmount(plano.amount)}
                      </option>
                    ))}
                  </select>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={redirecting !== null}
                  onClick={() => onSubscribe?.(planoAtual.id)}
                  data-plan={planoAtual.id}
                >
                  {redirecting === planoAtual.id ? (
                    <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : null}
                  {planos.length === 1
                    ? t('assinar.comValor', {
                        valor: formatAmount(planoAtual.amount),
                        intervalo: t(
                          `assinar.intervalo.${planoAtual.interval}`,
                        ),
                      })
                    : t('assinar.acao')}
                </Button>
              </>
            ) : null}

            {/**
             * O menu vem por último, depois da ação de assinar: assinar é o que a
             * tela quer que o cliente faça, e o menu guarda o resto.
             *
             * `z-10` o põe acima da área clicável da linha — sem isso o conteúdo do
             * menu aberto ficaria atrás dela, e clicar num item navegaria.
             */}
            {onDelete ? (
              <div className="relative z-10 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t('menu.acoesDaLinha')}
                        disabled={excluindo}
                      >
                        {excluindo ? (
                          t('menu.excluindo')
                        ) : (
                          <MoreHorizontalIcon className="size-4" />
                        )}
                      </Button>
                    }
                  />
                  <DropdownMenuContent>
                    {/**
                     * Mesmo destino do clique na linha, de propósito: a linha
                     * clicável não se anuncia, e o item nomeia o que o gesto faz.
                     */}
                    <DropdownMenuItem
                      render={
                        <Link href={href}>{t('menu.configuracoes')}</Link>
                      }
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={onDelete}>
                      {t('menu.excluir')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Centavos vêm da api; a moeda é de apresentação e o locale é o do operador. */
function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'BRL',
  })
}
