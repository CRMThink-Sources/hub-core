import { randomUUID } from 'node:crypto'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { Instance } from '@/modules/thinkzap/domain/entities/instance'
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
import { EnqueueWidgetTemplateResult } from './send-widget-template.types'

/**
 * A linha validada e sua âncora persistida — tudo que não muda entre destinatários.
 */
export type TemplateSendTarget = {
  item: SubscriptionItem
  instance: Instance
  /** Canal HubMessage da linha, já estreitado da união discriminada. */
  channelId: string
}

export type ResolveTemplateTargetInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
}

export type EnqueueTemplateIntentInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  templateName: string
  language: string
  bodyParameters: string[]
  templateBody: string
  entity: string
  entityId: string
  /** Operador que disparou, quando houve um: o robô de Bizproc não tem. */
  operatorBitrixUserId?: string
}

/**
 * O núcleo de "aceitar um envio de template e torná-lo durável", compartilhado entre
 * o widget e o robô de Bizproc.
 *
 * Está partido em **dois passos** de propósito. O widget envia para um destinatário e
 * resolveria os dois de uma vez; o robô resolve a linha uma vez e enfileira N
 * intenções. Um único método por destinatário faria o robô reler o contexto da
 * instalação — e revalidar a linha inteira — uma vez por telefone da entidade, o que
 * numa automação com contatos relacionados é a diferença entre uma leitura e uma
 * dúzia.
 *
 * O que **não** muda em relação ao caminho antigo: a ordem das recusas. Escopo →
 * habilitação → capacidade de provider → canal conectado acontece em `resolveTarget`,
 * antes de qualquer row nascer; telefone inválido recusa antes do enfileiramento. É
 * essa ordem que mantém o operador recebendo o erro que ele consegue consertar em vez
 * de uma falha assíncrona.
 */
export class EnqueueTemplateSendService {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository,
    /**
     * Resolvido **sem enviar nada**, só para a recusa de capacidade continuar
     * síncrona: `MapTemplateSenderResolver` lança `TemplateSendNotSupportedError`
     * quando o provider não está registrado — HubMessage sem `HUBMESSAGE_SECRET_KEY`,
     * por exemplo — e isso custa zero requisição. Sem esta checagem, uma instalação
     * mal configurada aceitaria o envio, e a falha só apareceria três tentativas
     * depois, na timeline.
     */
    private readonly templateSenderResolver: TemplateMessageSenderResolver,
    private readonly outbox: PrismaWidgetOutboxRepository,
    private readonly sendQueue: WidgetSendQueue,
  ) {}

  /**
   * Valida a linha e garante a âncora de `Instance`.
   *
   * `requireEnabled: true` — enviar é operação de linha habilitada, e
   * `LineBlockedError` é o que o front distingue de falta de permissão. A mesma
   * chamada valida provider (`ConnectorNotTemplateCapableError` para Z-API) e canal
   * conectado (`ChannelNotConnectedError` sem `wabaId`), nessa ordem.
   */
  async resolveTarget(
    input: ResolveTemplateTargetInput,
  ): Promise<TemplateSendTarget> {
    const { item } = await resolveTemplateLine(
      input,
      { getAplicationContext: this.getAplicationContext },
      { requireEnabled: true },
    )

    /**
     * `resolveTemplateLine` já garantiu `provider === 'HUBMESSAGE'`; o narrow aqui é
     * para o TypeScript alcançar `hubmessageChannelId` na união discriminada.
     */
    if (item.metadata.provider !== 'HUBMESSAGE') {
      throw new Error('Linha sem canal HubMessage para envio de template')
    }

    /**
     * A âncora nasce **depois** das recusas e **antes** da row de outbox: a row tem
     * chave estrangeira para `Instance.id`, e um envio recusado não pode deixar
     * registro para trás.
     */
    const instance = await ensureLineInstance(
      item,
      input.domainId,
      this.instances,
    )

    return {
      item,
      instance,
      channelId: item.metadata.hubmessageChannelId,
    }
  }

  /**
   * Grava a intenção e enfileira — um destinatário por chamada.
   *
   * O corpo é resolvido aqui, e não no worker, porque é o texto que três consumidores
   * diferentes leem: o histórico do CRM, a conversa do canal aberto e o aviso de
   * falha na timeline. Resolver depois obrigaria o worker a guardar o corpo cru só
   * para refazer a substituição, e um template editado na Meta entre a aceitação e a
   * entrega mudaria o texto do histórico sem que ninguém pedisse.
   */
  async enqueue(
    target: TemplateSendTarget,
    input: EnqueueTemplateIntentInput,
  ): Promise<EnqueueWidgetTemplateResult> {
    const normalizedPhone = normalizePhoneNumber(input.destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      throw new Error('Invalid destination phone number')
    }

    this.templateSenderResolver.resolve(ConnectorProvider.HUBMESSAGE, {
      channelId: target.channelId,
      recipientIdentifier: normalizedPhone,
    })

    const sentText = resolveTemplateBody(
      input.templateBody,
      input.bodyParameters,
    )

    const clientMessageId = randomUUID()

    /**
     * O par (template, parâmetros) vai junto porque é o que o provider recebe — o
     * corpo resolvido não tem volta. `text` guarda o resolvido para todo o resto.
     */
    const row = await this.outbox.create({
      kind: 'TEMPLATE',
      clientMessageId,
      instanceId: target.instance.id,
      subscriptionItemId: input.subscriptionItemId,
      domainId: input.domainId,
      appCode: input.appCode,
      destination: normalizedPhone,
      text: sentText,
      entity: input.entity,
      entityId: input.entityId,
      templateName: input.templateName,
      templateLanguage: input.language,
      templateParameters: input.bodyParameters,
      /**
       * Guardado para rastro, não para prefixo: o despacho de template não passa pelo
       * preparo de texto. Nulo no caminho do robô de Bizproc, que não tem operador.
       */
      operatorBitrixUserId: input.operatorBitrixUserId ?? null,
    })

    /**
     * Depois do commit da row. Se o enfileiramento falhar, a intenção fica `PENDING`
     * no banco — visível para o alerta de pendência antiga e recuperável — em vez de
     * desaparecer. A ordem inversa perderia a mensagem.
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
