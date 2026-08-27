'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateAgentModal } from '../_components/create-agent-modal'
import {
  apiErrorMessage,
  deleteAgent,
  listAgents,
  listBots,
  MAX_AGENTS,
  type Agent,
} from '../_lib/gptmaker-client'

export default function AgentesPage() {
  const { t } = useTranslation('gptmaker/agentes')

  const [agents, setAgents] = useState<Agent[]>([])
  const [botNames, setBotNames] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAgents(await listAgents())
    } catch (e) {
      toast.error(apiErrorMessage(e, t('lista.erroCarregar')))
    } finally {
      setLoading(false)
    }
  }, [t])

  /**
   * Os nomes dos bots são um enfeite da lista, e por isso são buscados à parte
   * e em silêncio: o portal pode não responder, e uma lista de agentes que
   * some por causa do nome do bot seria pior do que uma que mostra só o id.
   */
  const loadBotNames = useCallback(async () => {
    try {
      const bots = await listBots()
      setBotNames(new Map(bots.map(bot => [bot.id, bot.name])))
    } catch {
      setBotNames(new Map())
    }
  }, [])

  useEffect(() => {
    void load()
    void loadBotNames()
  }, [load, loadBotNames])

  async function handleDelete(agent: Agent) {
    if (!window.confirm(t('excluir.confirmar', { nome: agentLabel(agent) })))
      return

    setRemoving(agent.gptMakerAgentId)
    try {
      await deleteAgent(agent.gptMakerAgentId)
      toast.success(t('excluir.sucesso'))
      await load()
    } catch (e) {
      toast.error(apiErrorMessage(e, t('excluir.erro')))
    } finally {
      setRemoving(null)
    }
  }

  const atLimit = agents.length >= MAX_AGENTS

  return (
    <div className="flex flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('lista.titulo')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('lista.contador', { atual: agents.length, maximo: MAX_AGENTS })}
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} disabled={atLimit}>
          {t('acoes.novoAgente')}
        </Button>
      </header>

      {/* O teto é do Bitrix (5 imbots por aplicação), não do plano. Dizer isso
          na tela evita o chamado "por que não consigo criar mais". */}
      {atLimit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('lista.limiteAtingido', { maximo: MAX_AGENTS })}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t('lista.vazio')}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {agents.map(agent => (
            <li
              key={agent.gptMakerAgentId}
              className="relative flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring"
            >
              <div className="min-w-0">
                {/* O link cobre a linha inteira (`after:absolute inset-0`), então
                    clicar em qualquer ponto abre a configuração sem que a linha
                    precise virar um `div` com onClick — o teclado e o "abrir em
                    nova aba" continuam funcionando. */}
                <Link
                  href={`/gptmaker/agentes/${agent.gptMakerAgentId}`}
                  className="truncate font-medium outline-none after:absolute after:inset-0 after:rounded-lg"
                >
                  {agentLabel(agent)}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {agent.botId === null
                    ? t('lista.semBot')
                    : botNames.has(agent.botId)
                      ? t('lista.comBotNomeado', {
                          nome: botNames.get(agent.botId),
                          botId: agent.botId,
                        })
                      : t('lista.comBot', { botId: agent.botId })}
                  {/* `vendor` ausente = o GPT Maker não respondeu. A lista vem
                      do nosso banco, então ela aparece mesmo assim. */}
                  {!agent.vendor && ` · ${t('lista.perfilIndisponivel')}`}
                </p>
              </div>

              {/* `z-10` põe o menu acima da área clicável da linha. */}
              <div className="relative z-10 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t('acoes.acoesDoAgente')}
                        disabled={removing === agent.gptMakerAgentId}
                      >
                        {removing === agent.gptMakerAgentId ? (
                          t('acoes.excluindo')
                        ) : (
                          <MoreHorizontalIcon className="size-4" />
                        )}
                      </Button>
                    }
                  />
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      render={
                        <Link
                          href={`/gptmaker/agentes/${agent.gptMakerAgentId}`}
                        >
                          {t('acoes.configurar')}
                        </Link>
                      }
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void handleDelete(agent)}
                    >
                      {t('acoes.excluir')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateAgentModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void load()}
      />
    </div>
  )
}

function agentLabel(agent: Agent): string {
  return agent.vendor?.name ?? agent.name ?? agent.gptMakerAgentId
}
