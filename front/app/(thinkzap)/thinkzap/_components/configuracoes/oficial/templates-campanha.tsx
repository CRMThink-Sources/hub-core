'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import {
  useLineApi,
  type LineTemplateProviders,
  type TemplateProvider,
} from '@/app/hooks/use-line-api'
import { ConfigCard } from '../config-card'

type Props = {
  itemId: string
  /** Bloqueia as ações sem esconder a lista, como o resto da aba de ajustes. */
  bloqueada: boolean
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: LineTemplateProviders }

/**
 * Exemplo do texto que o cliente precisa pôr no corpo da campanha.
 *
 * Placeholders de CRM (`#LEAD.TITLE#`) e não valores literais: é o Bitrix que os
 * resolve por destinatário, antes de chamar o handler, e é isso que faz uma campanha
 * de mil contatos mandar mil textos diferentes. Um exemplo com valor fixo ensinaria o
 * cliente a mandar o mesmo nome para todo mundo.
 */
function exemploDeCorpo(parameterCount: number): string {
  if (parameterCount === 0) return ''

  return Array.from(
    { length: parameterCount },
    (_, i) => `#LEAD.FIELD_${i + 1}#`,
  ).join(';')
}

/**
 * Oferecer templates aprovados na campanha de SMS do Bitrix — um provedor por
 * template.
 *
 * O opt-in é por template de propósito: registrar o catálogo inteiro multiplicaria a
 * lista de provedores do cliente pelo número de templates aprovados, e a maioria nunca
 * vira campanha. Quem decide o tamanho daquela lista é ele.
 */
export function TemplatesCampanha({ itemId, bloqueada }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const api = useLineApi(itemId)

  const [state, setState] = useState<State>({ status: 'loading' })
  const [pendente, setPendente] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setState({ status: 'ready', data: await api.getSmsTemplates() })
    } catch (err) {
      setState({
        status: 'error',
        message: extractThinkzapError(err, t('campanha.erroLeitura')),
      })
    }
  }, [api, t])

  useEffect(() => {
    let cancelado = false

    setState({ status: 'loading' })

    api
      .getSmsTemplates()
      .then(data => {
        if (!cancelado) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setState({
            status: 'error',
            message: extractThinkzapError(err, t('campanha.erroLeitura')),
          })
        }
      })

    return () => {
      cancelado = true
    }
  }, [api, t])

  async function alternar(template: TemplateProvider) {
    const chave = template.code
    setPendente(chave)

    const payload = {
      templateName: template.templateName,
      language: template.language,
    }

    try {
      if (template.registered) {
        await api.removeSmsTemplate(payload)
        toast.success(t('campanha.removido'))
      } else {
        const { result } = await api.registerSmsTemplate(payload)
        toast.success(
          result === 'skipped'
            ? t('campanha.indisponivel')
            : t('campanha.registrado'),
        )
      }
      await carregar()
    } catch (err) {
      toast.error(extractThinkzapError(err, t('campanha.erroAcao')))
    } finally {
      setPendente(null)
    }
  }

  const card = (children: React.ReactNode) => (
    <ConfigCard
      title={t('campanha.titulo')}
      description={t('campanha.descricao')}
    >
      {children}
    </ConfigCard>
  )

  if (state.status === 'loading') {
    return card(
      <p className="text-sm text-muted-foreground">{t('carregando')}</p>,
    )
  }

  if (state.status === 'error') {
    return card(<p className="text-sm text-destructive">{state.message}</p>)
  }

  const { available, templates } = state.data

  return card(
    <>
      <p className="flex gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        {t('campanha.comoUsar')}
      </p>

      {!available && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('campanha.indisponivelAmbiente')}
        </p>
      )}

      {bloqueada && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('campanha.bloqueada')}
        </p>
      )}

      {templates.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('campanha.vazio')}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {templates.map(template => {
            const exemplo = exemploDeCorpo(template.parameterCount)

            return (
              <li
                key={template.code}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {template.templateName}{' '}
                    <span className="font-normal text-muted-foreground">
                      · {template.language}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {template.parameterCount === 0
                      ? t('campanha.semVariaveis')
                      : t('campanha.comVariaveis', {
                          count: template.parameterCount,
                        })}
                  </p>
                  {exemplo && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('campanha.exemplo')}{' '}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono">
                        {exemplo}
                      </code>
                    </p>
                  )}
                  {template.hasDynamicButton && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {t('campanha.botaoDinamico')}
                    </p>
                  )}
                  {template.hasImageHeader && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {t('campanha.cabecalhoImagem')}
                    </p>
                  )}
                </div>

                {/* Remover continua liberado: o provedor pode ter sido registrado antes dos botões. */}
                <Button
                  size="sm"
                  variant={template.registered ? 'outline' : 'default'}
                  disabled={
                    !available ||
                    bloqueada ||
                    pendente !== null ||
                    ((template.hasDynamicButton || template.hasImageHeader) &&
                      !template.registered)
                  }
                  onClick={() => {
                    void alternar(template)
                  }}
                  className={
                    template.registered
                      ? 'border-destructive text-destructive hover:bg-destructive/10'
                      : undefined
                  }
                >
                  {pendente === template.code
                    ? t('campanha.salvando')
                    : template.registered
                      ? t('campanha.remover')
                      : t('campanha.oferecer')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </>,
  )
}
