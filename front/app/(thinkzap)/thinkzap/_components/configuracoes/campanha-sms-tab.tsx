'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import { useLineApi, type LineEntitlement } from '@/app/hooks/use-line-api'
import { LinhaBloqueadaAviso } from './linha-bloqueada-aviso'
import { SmsProviderCard } from './sms-provider-card'

type Props = { itemId: string }

type Situacao =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entitlement: LineEntitlement }

/**
 * Aba da campanha de SMS do Bitrix24.
 *
 * Saiu de Ajustes porque lá ela dividia a tela com campos que dependem de "Salvar",
 * e o registro aqui é ação imediata — misturados, o botão de salvar parecia valer
 * para tudo, ou para nada.
 *
 * O `entitlement` vem de `getSettings`, a mesma leitura de Ajustes: é a regra de
 * habilitação do backend, e derivá-la da assinatura no contexto duplicaria a regra
 * mais uma vez. Se a leitura falha, as ações ficam travadas: oferecer a linha antes de saber se ela está habilitada poria na campanha
 * um provedor que recusa todo destinatário. A recusa autoritativa segue sendo o `402`.
 */
export function CampanhaSmsTab({ itemId }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/campanha-sms')
  const api = useLineApi(itemId)

  const [situacao, setSituacao] = useState<Situacao>({ status: 'loading' })

  const carregar = useCallback(async () => {
    setSituacao({ status: 'loading' })
    try {
      const { entitlement } = await api.getSettings()
      setSituacao({ status: 'ready', entitlement })
    } catch (err: unknown) {
      setSituacao({
        status: 'error',
        message: extractThinkzapError(err, t('erroSituacao')),
      })
    }
  }, [api, t])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const bloqueada =
    situacao.status !== 'ready' || situacao.entitlement !== 'active'

  return (
    <div className="flex flex-col gap-6">
      {situacao.status === 'ready' && situacao.entitlement !== 'active' && (
        <LinhaBloqueadaAviso
          entitlement={situacao.entitlement}
          namespace="thinkzap/configuracoes/campanha-sms"
        />
      )}

      {situacao.status === 'error' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">{t('erroSituacaoTitulo')}</p>
          <p className="mt-1 text-sm">{situacao.message}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-fit"
            onClick={() => void carregar()}
          >
            {t('tentarNovamente')}
          </Button>
        </div>
      )}

      {/* Só depois da situação: com o card montado antes, o aviso de "assinatura
          não ativa" piscaria em toda linha ativa enquanto a leitura corre. */}
      {situacao.status === 'loading' ? (
        <div className="flex items-center gap-2 py-8">
          <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="text-sm text-muted-foreground">
            {t('carregando')}
          </span>
        </div>
      ) : (
        <SmsProviderCard itemId={itemId} bloqueada={bloqueada} />
      )}
    </div>
  )
}
