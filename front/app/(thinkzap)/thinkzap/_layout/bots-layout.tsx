'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { toast } from 'sonner'
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
import type { BotFlowBinding, BotFlowSummary } from '@/shared/thinkzap-bot-flow'
import { BotFlowEditor } from '../_components/bots/bot-flow-editor'
import { BotFlowList } from '../_components/bots/bot-flow-list'
import { NovoFluxoDialog } from '../_components/bots/novo-fluxo-dialog'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; flows: BotFlowSummary[] }

// Editor é estado desta tela, não rota própria: o "voltar" competiria com a
// navegação do Bitrix.
export default function BotsLayout() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [bindings, setBindings] = useState<BotFlowBinding[]>([])
  const [linhas, setLinhas] = useState<OpenChannel[] | null>(null)
  const [linhasErro, setLinhasErro] = useState<string | null>(null)
  const [openFlowId, setOpenFlowId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      // Canais vêm do portal do cliente e falham por conta própria; capturar o erro
      // aqui evita que a falha esconda os fluxos, que seguem editáveis.
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
        // Erro e "portal sem canais" viravam o mesmo `[]`, e a célula dizia "nenhum
        // canal aberto ativo" nos dois casos.
        console.log('[thinkbot] falha ao listar canais abertos:', canais.err)
        setLinhasErro(
          canais.err instanceof Error
            ? canais.err.message
            : 'falha ao listar canais',
        )
        setLinhas([])
      }

      setState({ kind: 'ready', flows })
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os fluxos.',
      })
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function handleCriar(name: string) {
    try {
      const flow = await createBotFlow(name)
      setCriando(false)
      // Abre já no editor: criar sem editar não entrega nada ao usuário.
      setOpenFlowId(flow.id)
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível criar.',
      )
    }
  }

  // Recarrega em vez de atualizar o estado local: a API mexe no portal do cliente e
  // pode recusar (canal tomado por outro app).
  async function handleVincular(flowId: string, lineId: string) {
    try {
      await createBotFlowBinding({ flowId, lineId })
      toast.success('Fluxo ativado no canal.')
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível vincular.',
      )
    }
  }

  async function handleDesvincular(bindingId: string) {
    try {
      await deleteBotFlowBinding(bindingId)
      toast.success('Vínculo removido. O canal volta ao atendimento humano.')
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover o vínculo.',
      )
    }
  }

  async function handleExcluir(flowId: string) {
    try {
      await deleteBotFlow(flowId)
      toast.success('Fluxo excluído.')
      await carregar()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível excluir.',
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            ThinkBot
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte o fluxo do atendimento: o bot conversa pelo caminho que você
            desenhar e passa para um atendente quando o fluxo mandar.
          </p>
        </div>
      </div>

      {state.kind === 'loading' ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="animate-pulse text-sm font-medium text-muted-foreground">
            Carregando
          </span>
        </div>
      ) : state.kind === 'error' ? (
        // Falha de leitura não vira lista vazia: convidaria a recriar o que existe.
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">
            Não foi possível carregar os fluxos
          </p>
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
