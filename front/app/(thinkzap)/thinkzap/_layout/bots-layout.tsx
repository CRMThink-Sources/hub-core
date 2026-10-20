'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  createBotFlow,
  createBotFlowBinding,
  deleteBotFlow,
  deleteBotFlowBinding,
  listBotFlowBindings,
  listBotFlows,
  listOpenChannels,
  type OpenChannel,
} from '../_lib/bot-flow-client'
import {
  MAX_FLOWS_PER_APP,
  type BotFlowBinding,
  type BotFlowSummary,
} from '@/shared/thinkzap-bot-flow'
import { BotFlowEditor } from '../_components/bots/bot-flow-editor'
import { BotFlowList } from '../_components/bots/bot-flow-list'
import { NovoFluxoDialog } from '../_components/bots/novo-fluxo-dialog'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; flows: BotFlowSummary[] }

// Editor é estado, não rota: "voltar" competiria com a navegação do Bitrix
export default function BotsLayout() {
  const { t } = useTranslation('thinkzap/bots/lista')
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [bindings, setBindings] = useState<BotFlowBinding[]>([])
  const [linhas, setLinhas] = useState<OpenChannel[] | null>(null)
  const [linhasErro, setLinhasErro] = useState<string | null>(null)
  const [openFlowId, setOpenFlowId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      // Falha nos canais do portal não pode esconder os fluxos
      const [flows, vinculos, canais] = await Promise.all([
        listBotFlows(),
        listBotFlowBindings(),
        listOpenChannels().then(
          todas => ({ ok: true, todas }) as const,
          (err: unknown) => ({ ok: false, err }) as const,
        ),
      ])

      setBindings(vinculos)

      if (canais.ok) {
        setLinhasErro(null)
        setLinhas(canais.todas.filter(canal => canal.active))
      } else {
        // Sem isso, erro e "portal sem canais" viram o mesmo `[]`
        console.log('[thinkbot] falha ao listar canais abertos:', canais.err)
        setLinhasErro(
          canais.err instanceof Error
            ? canais.err.message
            : t('erro.listarCanais'),
        )
        setLinhas([])
      }

      setState({ kind: 'ready', flows })
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : t('erro.carregar'),
      })
    }
  }, [t])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function handleCriar(name: string) {
    try {
      const flow = await createBotFlow(name)
      setCriando(false)
      setOpenFlowId(flow.id)
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('toast.criarFalhou'),
      )
    }
  }

  // Recarrega em vez de mexer no estado local: a API pode recusar (canal tomado)
  async function handleVincular(flowId: string, lineId: string) {
    try {
      await createBotFlowBinding({ flowId, lineId })
      toast.success(t('toast.vinculado'))
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('toast.vincularFalhou'),
      )
    }
  }

  async function handleDesvincular(bindingId: string) {
    try {
      await deleteBotFlowBinding(bindingId)
      toast.success(t('toast.desvinculado'))
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('toast.desvincularFalhou'),
      )
    }
  }

  async function handleExcluir(flowId: string) {
    try {
      await deleteBotFlow(flowId)
      toast.success(t('toast.excluido'))
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('toast.excluirFalhou'),
      )
    }
  }

  if (openFlowId) {
    return (
      <BotFlowEditor
        flowId={openFlowId}
        onClose={() => {
          setOpenFlowId(null)
          void carregar()
        }}
      />
    )
  }

  const noLimite =
    state.kind === 'ready' && state.flows.length >= MAX_FLOWS_PER_APP

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t('titulo')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitulo')}</p>
        </div>
        {/* Lista vazia já tem o próprio botão de criar */}
        {state.kind === 'ready' && state.flows.length > 0 ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Button onClick={() => setCriando(true)} disabled={noLimite}>
              <Plus className="h-4 w-4" />
              {t('novoFluxo')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {noLimite
                ? t('limiteAtingido', { max: MAX_FLOWS_PER_APP })
                : t('contagem', {
                    total: state.flows.length,
                    max: MAX_FLOWS_PER_APP,
                  })}
            </span>
          </div>
        ) : null}
      </div>

      {state.kind === 'loading' ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="animate-pulse text-sm font-medium text-muted-foreground">
            {t('carregando')}
          </span>
        </div>
      ) : state.kind === 'error' ? (
        // Falha de leitura não vira lista vazia: convidaria a recriar o que existe
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">{t('erro.titulo')}</p>
          <p className="mt-1 text-sm">{state.message}</p>
        </div>
      ) : (
        <BotFlowList
          flows={state.flows}
          bindings={bindings}
          linhas={linhas}
          linhasErro={linhasErro}
          onOpen={setOpenFlowId}
          onDelete={handleExcluir}
          onCreate={() => setCriando(true)}
          onVincular={handleVincular}
          onDesvincular={handleDesvincular}
        />
      )}

      <NovoFluxoDialog
        open={criando}
        onOpenChange={setCriando}
        onSubmit={handleCriar}
      />
    </div>
  )
}
