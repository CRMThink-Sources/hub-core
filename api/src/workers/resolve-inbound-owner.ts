import type { InboundRouting } from '@/modules/thinkzap/domain/inbound-failure-routing'
import type { ResolvedInboundOwner } from './capture-inbound-failure'

type Deps = {
  getDomainByName: (
    name: string,
  ) => Promise<{ id: string; name: string } | null>
  getDomainById: (id: string) => Promise<{ id: string; name: string } | null>
  getInstanceByZApiInstanceId: (
    id: string,
  ) => Promise<{ id: string; domainId: string } | null>
  getInstanceByChannelId: (
    id: string,
  ) => Promise<{ id: string; domainId: string } | null>
}

/**
 * Do que o `body` do evento aponta até o portal, em melhor esforço. A Z-API e a
 * HubMessage só trazem um id do provider, então passam pela instância; o Bitrix traz o
 * nome do portal. Falha de lookup devolve o que já se sabe, sem lançar: a falha de
 * recebimento é registrada mesmo sem portal (e então só aparece na lista geral).
 */
export function makeResolveInboundOwner(deps: Deps) {
  return async (routing: InboundRouting): Promise<ResolvedInboundOwner> => {
    try {
      if (routing.domainName) {
        const domain = await deps.getDomainByName(routing.domainName)
        return domain
          ? { domainId: domain.id, domainName: domain.name }
          : { domainName: routing.domainName }
      }

      const instance = routing.zApiInstanceId
        ? await deps.getInstanceByZApiInstanceId(routing.zApiInstanceId)
        : routing.channelId
          ? await deps.getInstanceByChannelId(routing.channelId)
          : null
      if (!instance) return {}

      const domain = await deps.getDomainById(instance.domainId)
      return {
        instanceId: instance.id,
        domainId: instance.domainId,
        ...(domain ? { domainName: domain.name } : {}),
      }
    } catch {
      return {}
    }
  }
}
