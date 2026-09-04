import { env } from '@/config/env'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { resolveZApiContactIdentity } from '@/modules/thinkzap/application/resolve-zapi-contact-identity'
import { PrismaContactIdentityRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-contact-identity.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'
import { resolveOpenChannelContactId } from '@/shared/helpers/open-channel-contact-id'

export type WidgetOpenChannelContact = {
  /** `chat.id`/`user.id` no Bitrix. */
  id: string
  /** Telefone real do destino, quando há. */
  phone: string | null
}

export type ResolveWidgetOpenChannelContact = (input: {
  item: SubscriptionItem
  /** `Instance.id` — escopo do mapa. */
  instanceDbId: string
  /** O número que o operador digitou. */
  destination: string
}) => Promise<WidgetOpenChannelContact>

/**
 * A identidade do contato para a conversa aberta pelo widget.
 *
 * **Provider-aware, e é isso que muda aqui.** A abertura de conversa era a mesma
 * operação para os dois providers, porque a identidade era o telefone dos dois lados.
 * Deixou de ser: em linha Z-API a identidade é o LID, e o widget só conhece o número
 * digitado.
 *
 * A ponte é o `phone-exists`, que devolve o LID de um telefone. Sem ele, a identidade
 * por LID quebraria a direção do CRM — foi exatamente por não conhecê-lo que a
 * identidade tinha sido movida do lid para o telefone antes.
 *
 * O WhatsApp Oficial não tem LID: `sender.identifier` da HubMessage é telefone, e lá a
 * regra atual (`resolveOpenChannelContactId`) continua correta.
 */
export function makeResolveWidgetOpenChannelContact(): ResolveWidgetOpenChannelContact {
  const identityRepo = new PrismaContactIdentityRepository()

  return async ({ item, instanceDbId, destination }) => {
    const phone = normalizePhoneNumber(destination)

    if (item.metadata.provider !== 'ZAPI') {
      return { id: resolveOpenChannelContactId(destination), phone }
    }

    const { zApiInstanceId, zApiInstanceToken } = item.metadata

    /**
     * O evento sintético existe porque a cadeia é a mesma dos dois lados, e ela **tem**
     * que ser: se o widget resolvesse a identidade por outro caminho, as duas direções
     * voltariam a divergir — que é a origem do defeito.
     */
    const resolved = await resolveZApiContactIdentity(
      { phone: destination, chatLid: null, senderLid: null },
      instanceDbId,
      {
        identityRepo,
        phoneExists: async value => {
          if (!zApiInstanceToken) return null
          return new ZApiClient(
            env.zApi.partnerToken,
            env.zApi.clientToken,
          ).phoneExists(zApiInstanceId, zApiInstanceToken, value)
        },
        useLidIdentity: env.thinkzapZApiLidIdentity,
      },
    )

    return { id: resolved.identity, phone: resolved.phone ?? phone }
  }
}
