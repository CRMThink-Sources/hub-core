import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { resolveLineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { resolveInstanceProvider } from './helpers/resolve-instance-provider'

export type MessageDirectionCounts = {
  sent: number
  received: number
}

export type ThinkzapHomeMessageStats = {
  /** Ausente = domínio não tem linha Z-API ativa. */
  zapi?: MessageDirectionCounts
  /** Ausente = domínio não tem linha HubMessage ativa. */
  hubmessage?: MessageDirectionCounts
}

export type CountByInstanceAndSource = {
  countByInstanceAndSource(params: {
    instanceIds: string[]
    from: Date
    to: Date
  }): Promise<{ instanceId: string; source: string; count: number }[]>
}

/**
 * Contagem de mensagens enviadas/recebidas por provider, agregada por domínio,
 * para a home do ThinkZap.
 *
 * **Origem por provider, não por linha**: quem tem duas linhas Z-API vê uma soma
 * só sob `zapi` — a home não distingue linha individual (ver `design.md` da
 * change `thinkzap-home-message-stats`).
 *
 * A chave do provider só aparece na resposta quando o domínio tem ao menos uma
 * linha ativa daquele tipo — é o mesmo dado que decide quais cards o front
 * mostra, resolvido uma vez só aqui em vez de numa segunda chamada.
 */
export async function getThinkzapHomeMessageStats(params: {
  domainId: string
  appCode: string
  from: Date
  to: Date
  getAplicationContext: Pick<GetAplicationContext, 'execute'>
  instanceRepo: GetInstanceRepository
  messageRepo: CountByInstanceAndSource
}): Promise<ThinkzapHomeMessageStats> {
  const context = await params.getAplicationContext.execute({
    domainId: params.domainId,
    appCode: params.appCode,
  })

  const now = new Date()
  const lines = context.subscriptions.flatMap(subscription =>
    resolveLineEntitlement(subscription, now) === 'active'
      ? subscription.items.filter(item => item.metadata.provider !== 'NONE')
      : [],
  )

  const resolvedInstances = await Promise.all(
    lines.map(async item => {
      const localInstance =
        item.metadata.provider === 'HUBMESSAGE'
          ? await params.instanceRepo.getInstanceByChannelId(
              item.metadata.hubmessageChannelId,
            )
          : item.metadata.provider === 'ZAPI'
            ? await params.instanceRepo.getInstanceByInstanceId(
                item.metadata.zApiInstanceId,
              )
            : null

      /**
       * Linha sem âncora local ainda: nunca trocou mensagem, então não tem o que
       * contar. Não é criada aqui — leitura não provisiona (`ensureLineInstance`
       * é só para o caminho de escrita).
       */
      if (!localInstance) return null

      return {
        instanceDbId: localInstance.id,
        provider: resolveInstanceProvider(localInstance),
      }
    }),
  )

  const instances = resolvedInstances.filter(
    (value): value is NonNullable<typeof value> => value !== null,
  )

  const hasZapi = instances.some(i => i.provider === 'ZAPI')
  const hasHubmessage = instances.some(i => i.provider === 'HUBMESSAGE')

  const totals: Record<'ZAPI' | 'HUBMESSAGE', MessageDirectionCounts> = {
    ZAPI: { sent: 0, received: 0 },
    HUBMESSAGE: { sent: 0, received: 0 },
  }

  if (instances.length) {
    const providerByInstanceId = new Map(
      instances.map(i => [i.instanceDbId, i.provider]),
    )

    const counts = await params.messageRepo.countByInstanceAndSource({
      instanceIds: instances.map(i => i.instanceDbId),
      from: params.from,
      to: params.to,
    })

    for (const row of counts) {
      const provider = providerByInstanceId.get(row.instanceId)
      if (!provider) continue

      if (row.source === 'BITRIX') totals[provider].sent += row.count
      else totals[provider].received += row.count
    }
  }

  return {
    ...(hasZapi ? { zapi: totals.ZAPI } : {}),
    ...(hasHubmessage ? { hubmessage: totals.HUBMESSAGE } : {}),
  }
}
