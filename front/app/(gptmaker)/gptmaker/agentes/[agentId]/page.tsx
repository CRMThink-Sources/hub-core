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

/**
 * Seções da configuração. `atendimento` junta horário e bot porque as duas
 * respondem a mesma pergunta — quando e por onde o agente atende — e ficavam
 * empilhadas na mesma rolagem com o perfil.
 */
const SECTIONS = ['perfil', 'atendimento'] as const
type Section = (typeof SECTIONS)[number]

export default function AgentDetailPage() {
  const { t } = useTranslation('gptmaker/agentes')
  const params = useParams<{ agentId: string }>()
  const agentId = params?.agentId

  const [agent, setAgent] = useState<Agent | null>(null)
  const [section, setSection] = useState<Section>('perfil')
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
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`secoes.${section}Descricao`)}
          </p>
        </div>
        <Link href="/gptmaker/agentes">
          <Button variant="outline">{t('acoes.voltar')}</Button>
        </Link>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav
          aria-label={t('secoes.titulo')}
          className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible"
        >
          {SECTIONS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setSection(item)}
              aria-current={section === item ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors ${
                section === item
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              {t(`secoes.${item}`)}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {section === 'perfil' ? (
            <AgentProfileForm agent={agent} onSaved={() => void load()} />
          ) : (
            <>
              <WorktimeForm agent={agent} onSaved={setAgent} />
              <BotCard agent={agent} onChanged={setAgent} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
