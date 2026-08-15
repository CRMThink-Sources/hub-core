import { randomUUID } from 'node:crypto'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { TemplateMessageSenderResolver } from '@/modules/thinkzap/domain/ports/template-sender-resolver.port'
import { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { ensureLineInstance } from './helpers/ensure-line-instance'
import { resolveTemplateBody } from './helpers/resolve-template-body'
import { resolveTemplateLine } from './helpers/resolve-template-context'
import {
  EnqueueWidgetTemplateResult,
  SendWidgetTemplateInput,
} from './send-widget-template.types'

/**
 * Aceita o envio de um template pelo widget e o torna **durável** antes de responder.
 *
 * Substitui `SendWidgetTemplateUseCase`, que entregava dentro do request. O motivo é o
 * mesmo que tirou o envio livre de lá, e aqui pesa mais: um `500` transitório da
 * HubMessage perdia a mensagem, o operador via um erro e, se não reenviasse na hora,
 * ninguém reenviava por ele — só que template costuma ser **cobrado pela Meta**, então
 * o reenvio manual que resolvia a perda custava dinheiro do cliente.
 *
 * A divisão com o worker é a mesma do envio livre, e por isso mesmo: aqui fica tudo que
 * o operador resolve mudando alguma coisa — linha bloqueada, linha Z-API, canal não
 * conectado, telefone inválido, provider sem configuração. Retentativa não melhora
 * nenhuma delas, e transformá-las em falha assíncrona tiraria do operador exatamente os
 * erros que ele consegue consertar.
 *
 * O que vai para o worker é o que o tempo resolve: a chamada ao provider e os efeitos
 * colaterais (histórico, conversa no canal aberto, comentário de timeline).
 */
export class EnqueueWidgetTemplateUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository,
    /**
     * Resolvido aqui **sem enviar nada**, só para a recusa de capacidade continuar
     * síncrona.
     *
     * `MapTemplateSenderResolver` lança `TemplateSendNotSupportedError` quando o
     * provider não está registrado — HubMessage sem `HUBMESSAGE_SECRET_KEY`, por
     * exemplo — e isso custa zero requisição. Sem esta linha, uma instalação mal
     * configurada aceitaria o envio com `202`, e o operador só descobriria pelo aviso
     * de falha na timeline, três tentativas depois.
     */
    private readonly templateSenderResolver: TemplateMessageSenderResolver,
    private readonly outbox: PrismaWidgetOutboxRepository,
    private readonly sendQueue: WidgetSendQueue,
  ) {}

  async execute(
    input: SendWidgetTemplateInput,
  ): Promise<EnqueueWidgetTemplateResult> {
    const {
      subscriptionItemId,
      domainId,
      appCode,
      destination,
      templateName,
      language,
      bodyParameters,
      templateBody,
      entity,
      entityId,
    } = input

    /**
     * `requireEnabled: true` — enviar é operação de linha habilitada, e
     * `LineBlockedError` é o que o front distingue de falta de permissão. A mesma
     * chamada valida provider (`ConnectorNotTemplateCapableError` para Z-API) e canal
     * conectado (`ChannelNotConnectedError` sem `wabaId`), nessa ordem.
     */
    const { item } = await resolveTemplateLine(
      { subscriptionItemId, domainId, appCode },
      { getAplicationContext: this.getAplicationContext },
      { requireEnabled: true },
    )

    const normalizedPhone = normalizePhoneNumber(destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      throw new Error('Invalid destination phone number')
    }

    /**
     * `resolveTemplateLine` já garantiu `provider === 'HUBMESSAGE'`; o narrow aqui é
     * para o TypeScript alcançar `hubmessageChannelId` na união discriminada.
     */
    if (item.metadata.provider !== 'HUBMESSAGE') {
      throw new Error('Linha sem canal HubMessage para envio de template')
    }

    this.templateSenderResolver.resolve(ConnectorProvider.HUBMESSAGE, {
      channelId: item.metadata.hubmessageChannelId,
      recipientIdentifier: normalizedPhone,
    })

    /**
     * A âncora de `Instance` nasce aqui, e não no worker: a row de outbox tem chave
     * estrangeira para `Instance.id`. Depois de todas as recusas, para que um envio
     * recusado não deixe row para trás.
     *
     * Ordem invertida em relação ao caminho antigo, que criava a âncora **depois** do
     * envio aceito. Não dá para manter aquela ordem quando a intenção precisa existir
     * antes da chamada — e o resultado é o mesmo, porque as recusas todas acontecem
     * antes desta linha.
     */
    const instance = await ensureLineInstance(item, domainId, this.instances)

    /**
     * O corpo é resolvido **no request**, e não no worker, porque é o texto que três
     * consumidores diferentes precisam ler: o histórico do CRM, a conversa do canal
     * aberto e o aviso de falha na timeline. Resolver depois obrigaria o worker a
     * guardar o corpo cru só para refazer a substituição, e um template editado na Meta
     * entre o clique e a entrega mudaria o texto do histórico sem que ninguém pedisse.
     */
    const sentText = resolveTemplateBody(templateBody, bodyParameters)

    const clientMessageId = randomUUID()

    /**
     * O par (template, parâmetros) vai junto porque é o que o provider recebe — o corpo
     * resolvido não tem volta. `text` guarda o resolvido para todo o resto.
     */
    const row = await this.outbox.create({
      kind: 'TEMPLATE',
      clientMessageId,
      instanceId: instance.id,
      subscriptionItemId,
      domainId,
      appCode,
      destination: normalizedPhone,
      text: sentText,
      entity,
      entityId,
      templateName,
      templateLanguage: language,
      templateParameters: bodyParameters,
    })

    /**
     * Depois do commit da row. Se o enfileiramento falhar, a intenção fica `PENDING` no
     * banco — visível para o alerta de pendência antiga e recuperável — em vez de
     * desaparecer. A ordem inversa perderia a mensagem exatamente como antes.
     */
    await this.sendQueue.enqueue({ outboxId: row.id })

    return {
      clientMessageId,
      status: 'queued',
      destination: normalizedPhone,
      sentText,
    }
  }
}
