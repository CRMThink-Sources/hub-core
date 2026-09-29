'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import { useLineApi, type LineSmsProvider } from '@/app/hooks/use-line-api'
import { ConfigCard } from './config-card'
import { ConfirmModal } from './confirm-modal'
import { TemplatesCampanha } from './oficial/templates-campanha'

type Props = {
  itemId: string
  /** Bloqueia as ações sem esconder o estado, como o resto da aba. */
  bloqueada: boolean
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: LineSmsProvider }

/**
 * Oferece a linha como provedor de mensagem da **campanha de SMS** do Bitrix.
 *
 * O par registrar/remover é o mesmo do portal admin, com duas diferenças que vêm de
 * quem está clicando:
 *
 * 1. **Linha bloqueada não registra.** Suporte atua na linha travada de propósito; o
 *    cliente não. Registrar sem habilitação poria na campanha dele um provedor que
 *    recusa todo destinatário.
 * 2. **Linha `ZAPI` exige ciência explícita.** Disparo em massa por número não oficial
 *    arrisca bloqueio pela Meta, e o bloqueio derruba junto o atendimento 1 a 1 da
 *    linha. No admin isso é um aviso; aqui quem clica é o dono do número.
 */
export function SmsProviderCard({ itemId, bloqueada }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/campanha-sms')
  const api = useLineApi(itemId)

  const [state, setState] = useState<State>({ status: 'loading' })
  const [confirmandoRegistro, setConfirmandoRegistro] = useState(false)
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false)
  const [ciente, setCiente] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setState({ status: 'ready', data: await api.getSmsProvider() })
    } catch (err) {
      setState({
        status: 'error',
        message: extractThinkzapError(err, t('erroLeitura')),
      })
    }
  }, [api, t])

  useEffect(() => {
    let cancelado = false

    setState({ status: 'loading' })

    api
      .getSmsProvider()
      .then(data => {
        if (!cancelado) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setState({
            status: 'error',
            message: extractThinkzapError(err, t('erroLeitura')),
          })
        }
      })

    return () => {
      cancelado = true
    }
  }, [api, t])

  function fecharModais() {
    setConfirmandoRegistro(false)
    setConfirmandoRemocao(false)
    setCiente(false)
  }

  async function registrar() {
    setSalvando(true)
    try {
      const { result } = await api.registerSmsProvider()
      toast.success(
        result === 'skipped' ? t('registroIndisponivel') : t('registrado'),
      )
      fecharModais()
      await carregar()
    } catch (err) {
      toast.error(extractThinkzapError(err, t('erroRegistro')))
    } finally {
      setSalvando(false)
    }
  }

  async function remover() {
    setSalvando(true)
    try {
      await api.removeSmsProvider()
      toast.success(t('removido'))
      fecharModais()
      await carregar()
    } catch (err) {
      toast.error(extractThinkzapError(err, t('erroRemocao')))
    } finally {
      setSalvando(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <ConfigCard title={t('titulo')} description={t('descricao')}>
        <p className="text-sm text-muted-foreground">{t('carregando')}</p>
      </ConfigCard>
    )
  }

  if (state.status === 'error') {
    return (
      <ConfigCard title={t('titulo')} description={t('descricao')}>
        <p className="text-sm text-destructive">{state.message}</p>
      </ConfigCard>
    )
  }

  const { registered, available, banRisk, perTemplate } = state.data

  /**
   * Linha oficial não tem provedor de linha: campanha por WhatsApp Oficial só sai com
   * template aprovado, e cada template é um provedor próprio. O card vira a lista de
   * templates, com a ação em cada um.
   *
   * A leitura do catálogo é do componente de baixo, não desta: o estado do provedor de
   * linha que esta busca não descreve nada na linha oficial, e ela só continua
   * acontecendo porque é o que diz **qual** dos dois caminhos renderizar.
   */
  if (perTemplate) {
    return <TemplatesCampanha itemId={itemId} bloqueada={bloqueada} />
  }

  /**
   * Ambiente sem a rota do handler publicada: registrar devolveria `skipped` e não
   * mudaria nada. Um botão que não faz nada e não explica por quê é pior que a
   * ausência dele — o card fica, dizendo que o recurso não está disponível aqui.
   */
  if (!available) {
    return (
      <ConfigCard title={t('titulo')} description={t('descricao')}>
        <p className="text-sm text-muted-foreground">{t('indisponivel')}</p>
      </ConfigCard>
    )
  }

  return (
    <>
      <ConfigCard title={t('titulo')} description={t('descricao')}>
        <p className="flex gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          {t('avisoRotulo')}
        </p>

        {banRisk && (
          <p className="mt-2 flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {t('avisoBloqueio')}
          </p>
        )}

        <p className="mt-4 text-sm text-foreground">
          {registered ? t('statusRegistrado') : t('statusNaoRegistrado')}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {registered ? (
            <Button
              variant="outline"
              disabled={bloqueada || salvando}
              onClick={() => setConfirmandoRemocao(true)}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              {t('remover')}
            </Button>
          ) : (
            <Button
              disabled={bloqueada || salvando}
              onClick={() => {
                /**
                 * Linha oficial não tem risco de bloqueio a reconhecer: pedir ciência
                 * ali transformaria uma salvaguarda real em clique cerimonial, e o
                 * aviso que importa perderia peso por repetição.
                 */
                if (banRisk) {
                  setCiente(false)
                  setConfirmandoRegistro(true)
                  return
                }
                void registrar()
              }}
            >
              {t('registrar')}
            </Button>
          )}
        </div>

        {bloqueada && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('bloqueadaHint')}
          </p>
        )}
      </ConfigCard>

      {/* Ciência explícita, só em linha ZAPI. O botão de confirmar fica inerte até o
          cliente marcar — o risco é do número dele, e o atendimento 1 a 1 cai junto. */}
      <Dialog
        open={confirmandoRegistro}
        onOpenChange={(next, details) => {
          if (next) return
          if (details.reason === 'outside-press') return
          fecharModais()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirmarTitulo')}</DialogTitle>
            <DialogDescription>{t('confirmarDescricao')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
              <Checkbox
                checked={ciente}
                onCheckedChange={next => setCiente(next === true)}
              />
              <span>{t('confirmarCiencia')}</span>
            </label>
          </DialogBody>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={fecharModais}
              disabled={salvando}
            >
              {t('cancelar')}
            </Button>
            <Button
              disabled={!ciente || salvando}
              onClick={() => {
                void registrar()
              }}
            >
              {t('confirmarRegistrar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={confirmandoRemocao}
        title={t('removerTitulo')}
        message={t('removerDescricao')}
        confirmLabel={t('removerConfirmar')}
        cancelLabel={t('cancelar')}
        loading={salvando}
        onConfirm={() => {
          void remover()
        }}
        onClose={fecharModais}
      />
    </>
  )
}
