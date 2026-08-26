'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  apiErrorMessage,
  bindBot,
  listBots,
  unbindBot,
  type Agent,
  type Bot,
} from '../_lib/gptmaker-client'

type Props = {
  agent: Agent
  onChanged: (agent: Agent) => void
}

/**
 * O vínculo entre agente e bot do portal.
 *
 * O bot é criado na tela de bots e vive por conta própria: aqui só se escolhe
 * qual deles responde por este agente. Desvincular preserva o bot — ele volta
 * para a lista e pode ser usado por outro agente.
 */
export function BotCard({ agent, onChanged }: Props) {
  const { t } = useTranslation('gptmaker/agentes')

  const [bots, setBots] = useState<Bot[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBots(await listBots())
    } catch (e) {
      toast.error(apiErrorMessage(e, t('bot.erroCarregar')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // Só os bots sem dono entram na escolha: vincular um bot ocupado é recusado
  // pela API, e oferecê-lo aqui só produziria um erro evitável.
  const available = bots.filter(bot => bot.boundToAgentId === null)
  const current = bots.find(bot => bot.id === agent.botId)

  async function handleBind() {
    if (!selected) {
      toast.error(t('bot.escolhaObrigatoria'))
      return
    }

    setWorking(true)
    try {
      const updated = await bindBot(agent.gptMakerAgentId, Number(selected))
      toast.success(t('bot.vinculado'))
      setSelected('')
      onChanged(updated)
      await load()
    } catch (e) {
      toast.error(apiErrorMessage(e, t('bot.erroVincular')))
    } finally {
      setWorking(false)
    }
  }

  async function handleUnbind() {
    setWorking(true)
    try {
      const updated = await unbindBot(agent.gptMakerAgentId)
      toast.success(t('bot.desvinculado'))
      onChanged(updated)
      await load()
    } catch (e) {
      toast.error(apiErrorMessage(e, t('bot.erroDesvincular')))
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
            : t('bot.comVinculo', {
                nome: current?.name ?? t('bot.semNome'),
                botId: agent.botId,
              })}
        </p>
      </div>

      {agent.botId !== null ? (
        <div>
          <Button
            variant="outline"
            onClick={() => void handleUnbind()}
            disabled={working}
          >
            {working ? t('acoes.removendo') : t('bot.desvincular')}
          </Button>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t('bot.carregando')}</p>
      ) : available.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            {t('bot.nenhumDisponivel')}
          </p>
          <Link href="/gptmaker/bots">
            <Button variant="outline">{t('bot.irParaBots')}</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-52 flex-1 flex-col gap-1.5">
            <Label>{t('bot.escolher')}</Label>
            <Select
              value={selected}
              onValueChange={value => setSelected(value ?? '')}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value: string) =>
                    available.find(bot => String(bot.id) === value)?.name ??
                    t('bot.escolherPlaceholder')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {available.map(bot => (
                  <SelectItem key={bot.id} value={String(bot.id)}>
                    {bot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => void handleBind()} disabled={working}>
            {working ? t('acoes.salvando') : t('bot.vincular')}
          </Button>
        </div>
      )}
    </section>
  )
}
