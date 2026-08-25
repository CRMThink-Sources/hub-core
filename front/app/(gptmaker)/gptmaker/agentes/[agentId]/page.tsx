'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AgentProfileForm } from '../../_components/agent-profile-form'
import { BotCard } from '../../_components/bot-card'
import { WorktimeForm } from '../../_components/worktime-form'
import {
  apiErrorMessage,
  getAgent,
  type Agent,
} from '../../_lib/gptmaker-client'

export default function AgentDetailPage() {
  const { t } = useTranslation('gptmaker/agentes')
  const params = useParams<{ agentId: string }>()
  const agentId = params?.agentId

  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!agentId) return

    setLoading(true)
    try {
      setAgent(await getAgent(agentId))
    } catch (e) {
      toast.error(apiErrorMessage(e, t('detalhe.erroCarregar')))
    } finally {
      setLoading(false)
    }
  }, [agentId, t])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          {t('detalhe.naoEncontrado')}
        </p>
        <Link href="/gptmaker/agentes" className="mt-4 inline-block">
          <Button variant="outline">{t('acoes.voltar')}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">
            {agent.vendor?.name ?? agent.name ?? agent.gptMakerAgentId}
          </h1>
        </div>
        <Link href="/gptmaker/agentes">
          <Button variant="outline">{t('acoes.voltar')}</Button>
        </Link>
      </header>

      <AgentProfileForm agent={agent} onSaved={() => void load()} />
      <WorktimeForm agent={agent} onSaved={setAgent} />
      <BotCard agent={agent} onChanged={setAgent} />
    </div>
  )
}
