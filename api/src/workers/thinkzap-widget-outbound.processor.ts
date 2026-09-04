import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { findItemInContext } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { EnsureWidgetOpenChannelConversation } from '@/modules/thinkzap/application/ensure-widget-open-channel-conversation'
import { makeGetCrmContactName } from '@/modules/thinkzap/application/get-crm-contact-name'
import { makeResolveWidgetOpenChannelContact } from '@/modules/thinkzap/main/make-resolve-widget-open-channel-contact'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  AppendJobLog,
  noopJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
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
  context: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
): Promise<void> {
  const { appendJobLog } = context
  const {
    subscriptionItemId,
    domainId,
    appCode,
    instanceId,
    providerMessageId,
    destination,
    text,
    entity,
    entityId,
  } = job

  const logContext = {
    app: 'thinkzap',
    subscriptionItemId,
    instanceId,
    providerMessageId,
  }

  /**
   * A primeira linha da aba precisa dizer **qual mensagem** este job acompanha.
   *
   * Sem ela, um job que termina em `toggle-off` mostra só "toggle desligado" e não há
   * como saber de que envio ele veio — foi a lacuna que apareceu investigando "o widget
   * disse que enviou e não chegou". Com o `providerMessageId` aqui, dá para consultar a
   * mensagem no painel da Z-API e separar "nunca saiu" de "saiu e não foi entregue".
   *
   * O envio em si **já aconteceu** quando este job roda: ele é efeito colateral. Se a
   * mensagem não chegou ao telefone, o problema não está neste job.
   */
  await appendJobLog(
    `Abertura de conversa para a mensagem ${providerMessageId} → ${destination}. ` +
      'O envio ao contato já ocorreu antes deste job.',
  )

  const domain = await new PrismaDomainRepository().getDomainById(domainId)
  if (!domain) {
    log.warn(
      { ...logContext, domainId },
      'Portal não encontrado; abertura de conversa descartada',
    )
    await appendJobLog(
      `Portal ${domainId} não encontrado. Conversa não será aberta.`,
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
  const applicationContext = await makeGetAplicationContext().execute({
    domainId,
    appCode,
  })

  let item
  try {
    item = findItemInContext(applicationContext, subscriptionItemId)
  } catch (err) {
    if (err instanceof LineNotFoundError) {
      log.warn(
        logContext,
        'Item de assinatura não está mais na instalação; abertura de conversa descartada',
      )
      await appendJobLog(
        `Item ${subscriptionItemId} não está mais na instalação. Conversa não será aberta.`,
      )
      return
    }
    throw err
  }

  const bitrix = await makeBitrixClientByDomainAndAppCoode(domain.name, appCode)

  const ensureOpenChannel = new EnsureWidgetOpenChannelConversation(
    bitrix,
    new PrismaThinkzapMessageRepository(),
    makeResolveWidgetOpenChannelContact(),
    makeGetCrmContactName(bitrix),
  )

  const { outcome, chatId, payload, error } = await ensureOpenChannel.execute({
    item,
    instanceId,
    providerMessageId,
    destination,
    text,
    /**
     * A entidade de origem vem da row do outbox e serve só para o **nome** da conversa
     * — sem ela, o título do chat seria o número, que é o que o operador via antes.
     */
    entity,
    entityId,
  })

  log.info(
    { ...logContext, openChannelOutcome: outcome, chatId, err: error },
    'Job de abertura de conversa processado',
  )

  await appendJobLog(describeOpenChannelOutcome(outcome, chatId, payload, error))

  /**
   * `EnsureWidgetOpenChannelConversation` nunca lança — devolve `failed`. Aqui a
   * tradução é obrigatória: sem transformar `failed` em exceção, o BullMQ marcaria o
   * job como concluído e a retentativa que justifica esta fila nunca aconteceria.
   *
   * A mensagem do erro do Bitrix entra no `throw` porque é isto que o Bull Board
   * mostra como "failed reason" — sem ela, a única pista de causa ficava presa no
   * log estruturado (Pino), fora do alcance de quem só olha o job.
   */
  if (outcome === 'failed') {
    throw new Error(
      `Falha ao abrir a conversa no canal aberto para a mensagem ${providerMessageId}` +
        (error ? `: ${error}` : ''),
    )
  }
}

/**
 * O desfecho em português para quem abre o job no Bull Board.
 *
 * Os três `skipped` são os que mais geram dúvida de suporte — "por que a conversa não
 * apareceu?" —, e cada um tem uma resposta diferente e acionável.
 */
function describeOpenChannelOutcome(
  outcome: string,
  chatId: string | null,
  payload?: unknown,
  error?: string,
): string {
  const descriptions: Record<string, string> = {
    opened: `Conversa ABERTA no canal aberto. chatId=${chatId ?? 'não devolvido pelo Bitrix'}`,
    'already-open': `Conversa já estava aberta (chatId=${chatId}). Nada re-postado.`,
    'toggle-off':
      'Toggle "Enviar para canal aberto" está DESLIGADO nesta linha. Comportamento correto — nada a corrigir.',
    'no-channel':
      'Linha não tem canal aberto vinculado. Vincular na aba Ajustes para a conversa passar a aparecer.',
    failed:
      'FALHOU ao chamar o Bitrix. Será retentado. A mensagem ao contato NÃO é afetada — ela já foi entregue.',
  }

  const description = descriptions[outcome] ?? `Desfecho: ${outcome}`

  /**
   * O payload só existe em `opened` — é o que a chamada `imconnector.send.messages`
   * de fato enviou. Anexado aqui, e não num log separado, porque é aqui que o suporte
   * já está olhando quando confere "o que foi mandado pro Bitrix": a aba do job no
   * Bull Board, na mesma linha que confirma o `chatId`.
   */
  if (outcome === 'opened' && payload !== undefined) {
    return `${description}. payload=${JSON.stringify(payload)}`
  }

  /**
   * Sem isto o log dizia só "FALHOU" e escondia a resposta do Bitrix (status +
   * corpo, montada em `BitrixClient.sendToOpenChannel`) atrás do log estruturado —
   * inacessível a quem só abre a aba do job no Bull Board.
   */
  if (outcome === 'failed' && error) {
    return `${description} erro=${error}`
  }

  return description
}
