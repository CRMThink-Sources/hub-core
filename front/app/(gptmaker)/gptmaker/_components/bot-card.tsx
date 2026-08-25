'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  apiErrorMessage,
  bindBot,
  unbindBot,
  type Agent,
} from '../_lib/gptmaker-client'

type Props = {
  agent: Agent
  onChanged: (agent: Agent) => void
}

export function BotCard({ agent, onChanged }: Props) {
  const { t } = useTranslation('gptmaker/agentes')
  const [working, setWorking] = useState(false)

  async function handleBind() {
    setWorking(true)
    try {
      const updated = await bindBot(
        agent.gptMakerAgentId,
        agent.vendor?.name ?? agent.name ?? undefined,
      )
      toast.success(t('bot.criado'))
      onChanged(updated)
    } catch (e) {
      toast.error(apiErrorMessage(e, t('bot.erroCriar')))
    } finally {
      setWorking(false)
    }
  }

  async function handleUnbind() {
    if (!window.confirm(t('bot.confirmarRemover'))) return

    setWorking(true)
    try {
      const updated = await unbindBot(agent.gptMakerAgentId)
      toast.success(t('bot.removido'))
      onChanged(updated)
    } catch (e) {
      toast.error(apiErrorMessage(e, t('bot.erroRemover')))
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-medium">{t('bot.titulo')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {agent.botId === null
            ? t('bot.semVinculo')
            : t('bot.comVinculo', { botId: agent.botId })}
        </p>
      </div>

      <div>
        {agent.botId === null ? (
          <Button onClick={() => void handleBind()} disabled={working}>
            {working ? t('acoes.criando') : t('bot.criar')}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => void handleUnbind()}
            disabled={working}
          >
            {working ? t('acoes.removendo') : t('bot.remover')}
          </Button>
        )}
      </div>
    </section>
  )
}
