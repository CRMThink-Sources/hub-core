'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateBotModal } from '../_components/create-bot-modal'
import {
  MAX_AGENTS,
  apiErrorMessage,
  deleteBot,
  listBots,
  type Bot,
} from '../_lib/gptmaker-client'

export default function BotsPage() {
  const { t } = useTranslation('gptmaker/bots')

  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBots(await listBots())
    } catch (e) {
      toast.error(apiErrorMessage(e, t('lista.erroCarregar')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(bot: Bot) {
    if (!window.confirm(t('excluir.confirmar', { nome: bot.name }))) return

    setRemoving(bot.id)
    try {
      await deleteBot(bot.id)
      toast.success(t('excluir.sucesso'))
      await load()
    } catch (e) {
      toast.error(apiErrorMessage(e, t('excluir.erro')))
    } finally {
      setRemoving(null)
    }
  }

  const atLimit = bots.length >= MAX_AGENTS

  return (
    <div className="flex flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('lista.titulo')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('lista.subtitulo')}
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} disabled={atLimit}>
          {t('acoes.novoBot')}
        </Button>
      </header>

      {/* O teto é do Bitrix: 5 imbots por aplicação em cada portal. */}
      {atLimit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('lista.limiteAtingido', { maximo: MAX_AGENTS })}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : bots.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t('lista.vazio')}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {bots.map(bot => (
            <li
              key={bot.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{bot.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('lista.identificador', { botId: bot.id })}
                  {' · '}
                  {bot.boundToAgentId === null
                    ? t('lista.livre')
                    : t('lista.vinculado', {
                        agente: bot.boundToAgentName ?? bot.boundToAgentId,
                      })}
                </p>
              </div>

              <div className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t('acoes.acoesDoBot')}
                        disabled={removing === bot.id}
                      >
                        {removing === bot.id ? (
                          t('acoes.excluindo')
                        ) : (
                          <MoreHorizontalIcon className="size-4" />
                        )}
                      </Button>
                    }
                  />
                  <DropdownMenuContent>
                    {/* Bot vinculado não pode ser removido: o agente ficaria
                        apontando para um BOT_ID inexistente, e o sintoma
                        (agente mudo) não diria nada sobre a causa. */}
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={bot.boundToAgentId !== null}
                      onClick={() => void handleDelete(bot)}
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

      <CreateBotModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void load()}
      />
    </div>
  )
}
