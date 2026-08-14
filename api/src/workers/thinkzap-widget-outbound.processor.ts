import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { findItemInContext } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { EnsureWidgetOpenChannelConversation } from '@/modules/thinkzap/application/ensure-widget-open-channel-conversation'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ThinkzapOpenChannelJob } from '@/queue/thinkzap-widget-outbound.queue'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')

/**
 * Cria a conversa no canal aberto para uma mensagem já entregue pelo widget.
 *
 * **O que muda em relação a rodar isto dentro do request:** aqui a falha de
 * infraestrutura **lança**. In-request ela era engolida por obrigação — a mensagem já
 * estava no telefone do contato e um erro que subisse viraria `500` na tela, o
 * operador reenviaria e o contato receberia duas vezes. Fora do request esse acoplamento
 * desaparece: o envio já respondeu, então lançar só significa "BullMQ, tente de novo".
 *
 * É seguro retentar porque `EnsureWidgetOpenChannelConversation` é idempotente pelo
 * `chat_id` persistido. Sem esse guard, `attempts: 3` postaria a mesma mensagem três
 * vezes no chat do cliente.
 *
 * **Estado não lança.** Portal apagado, item removido da SPA, instância órfã: nenhum
 * desses melhora com retentativa, e transformá-los em job falho encheria a fila de
 * trabalho que nunca vai passar. Log em `warn` e fim.
 */
export async function processWidgetOpenChannelJob(
  job: ThinkzapOpenChannelJob,
): Promise<void> {
  const {
    subscriptionItemId,
    domainId,
    appCode,
    instanceId,
    providerMessageId,
    destination,
    text,
  } = job

  const logContext = {
    app: 'thinkzap',
    subscriptionItemId,
    instanceId,
    providerMessageId,
  }

  const domain = await new PrismaDomainRepository().getDomainById(domainId)
  if (!domain) {
    log.warn(
      { ...logContext, domainId },
      'Portal não encontrado; abertura de conversa descartada',
    )
    return
  }

  /**
   * Resolvido pelo **id do item**, não pelo `instanceId` do provider.
   *
   * `findLineItemByInstanceId` casaria só linha `ZAPI` (o predicado exige
   * `provider === 'ZAPI'`), e este processor também serve o envio de template do
   * WhatsApp Oficial — linha `HUBMESSAGE` cairia em "item não encontrado" e a conversa
   * nunca abriria. O id do item vale para qualquer provider e já vem no payload.
   */
  const context = await makeGetAplicationContext().execute({
    domainId,
    appCode,
  })

  let item
  try {
    item = findItemInContext(context, subscriptionItemId)
  } catch (err) {
    if (err instanceof LineNotFoundError) {
      log.warn(
        logContext,
        'Item de assinatura não está mais na instalação; abertura de conversa descartada',
      )
      return
    }
    throw err
  }

  const bitrix = await makeBitrixClientByDomainAndAppCoode(domain.name, appCode)

  const ensureOpenChannel = new EnsureWidgetOpenChannelConversation(
    bitrix,
    new PrismaThinkzapMessageRepository(),
  )

  const { outcome, chatId } = await ensureOpenChannel.execute({
    item,
    instanceId,
    providerMessageId,
    destination,
    text,
  })

  log.info(
    { ...logContext, openChannelOutcome: outcome, chatId },
    'Job de abertura de conversa processado',
  )

  /**
   * `EnsureWidgetOpenChannelConversation` nunca lança — devolve `failed`. Aqui a
   * tradução é obrigatória: sem transformar `failed` em exceção, o BullMQ marcaria o
   * job como concluído e a retentativa que justifica esta fila nunca aconteceria.
   */
  if (outcome === 'failed') {
    throw new Error(
      `Falha ao abrir a conversa no canal aberto para a mensagem ${providerMessageId}`,
    )
  }
}
