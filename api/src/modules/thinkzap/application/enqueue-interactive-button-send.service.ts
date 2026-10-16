import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { assertDailyLimitNotReached } from './helpers/send-within-daily-quota'
import { randomUUID } from 'node:crypto'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { Instance } from '@/modules/thinkzap/domain/entities/instance'
import { ButtonChannelNotConnectedError } from '@/modules/thinkzap/domain/ports/button-errors'
import { ButtonAction } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { assertValidButtonsForProvider } from '@/modules/thinkzap/domain/ports/interactive-button-validation'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { assertLineConnected } from './helpers/assert-line-connected'
import { ensureLineInstance } from './helpers/ensure-line-instance'
import { assertConnectorLineEnabled } from './helpers/resolve-line-by-subscription-item'

/**
 * A linha validada e sua âncora persistida — tudo que não muda entre
 * destinatários. Ao contrário de `TemplateSendTarget`, carrega os dois
 * providers: botão é suportado nos dois, então o `enqueue` precisa saber qual
 * é para escolher a validação de tipo de botão certa.
 */
export type InteractiveButtonSendTarget = {
  item: SubscriptionItem
  instance: Instance
  provider: ConnectorProvider
}

export type ResolveInteractiveButtonTargetInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
}

export type EnqueueInteractiveButtonIntentInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  body: string
  header?: string
  footer?: string
  buttons: ButtonAction[]
  entity: string
  entityId: string
  /** Operador que disparou, quando houve um: o robô de Bizproc não tem. */
  operatorBitrixUserId?: string
}

export type EnqueueInteractiveButtonResult = {
  clientMessageId: string
  status: 'queued'
  destination: string
}

/**
 * O núcleo de "aceitar um envio de botões e torná-lo durável", compartilhado
 * entre o widget e os dois robôs de Bizproc — mirror de
 * `EnqueueTemplateSendService`, mas sem provider único: os dois são
 * suportados, então a linha valida "canal conectado" de um jeito por
 * provider e a lista de botões é validada contra o provider **resolvido**, não
 * contra um fixo.
 *
 * A ordem das recusas segue a mesma da spec: escopo → habilitação → tipos de
 * botão válidos para o provider → canal conectado → envio. `resolveTarget`
 * cobre até canal conectado; `enqueue` valida os botões e o destino antes de
 * gravar a intenção.
 */
export class EnqueueInteractiveButtonSendService {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository,
    private readonly zApiClient: ZApiClient,
    private readonly outbox: PrismaWidgetOutboxRepository,
    private readonly sendQueue: WidgetSendQueue,
    /** Ausente, não há pré-checagem do limite diário (a reserva no despacho continua). */
    private readonly quota: DailySendQuota | null = null,
  ) {}

  /**
   * Valida a linha (qualquer provider, habilitada, canal conectado) e garante
   * a âncora de `Instance`.
   *
   * "Canal conectado" difere por provider: HubMessage precisa de `wabaId`
   * (número conectado na Meta); Z-API precisa de leitura de status
   * confirmando conexão — falha de leitura não recusa, mesmo critério de
   * `assertLineConnected` no envio livre.
   */
  async resolveTarget(
    input: ResolveInteractiveButtonTargetInput,
  ): Promise<InteractiveButtonSendTarget> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const item = assertConnectorLineEnabled(
      context,
      input.subscriptionItemId,
      new Date(),
    )

    if (item.metadata.provider === 'HUBMESSAGE') {
      if (!item.metadata.wabaId) {
        throw new ButtonChannelNotConnectedError(input.subscriptionItemId)
      }
    } else if (item.metadata.provider === 'ZAPI') {
      await assertLineConnected(
        this.zApiClient,
        {
          zApiInstanceId: item.metadata.zApiInstanceId,
          zApiInstanceToken: item.metadata.zApiInstanceToken,
        },
        input.subscriptionItemId,
      )
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
      provider: item.metadata.provider as ConnectorProvider,
    }
  }

  /**
   * Grava a intenção e enfileira — um destinatário por chamada.
   *
   * O corpo vai para `text`: é o que o histórico, o canal aberto e o aviso de
   * falha na timeline leem. Os botões vão para `buttonPayload`, íntegros —
   * é o descriptor que o worker remonta para o adapter, sem recompor a partir
   * de `text`.
   */
  async enqueue(
    target: InteractiveButtonSendTarget,
    input: EnqueueInteractiveButtonIntentInput,
  ): Promise<EnqueueInteractiveButtonResult> {
    const normalizedPhone = normalizePhoneNumber(input.destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      throw new Error('Invalid destination phone number')
    }

    assertValidButtonsForProvider(target.provider, input.buttons)

    // Por destinatário: os robôs enfileiram N, e a vaga pode acabar no meio.
    await assertDailyLimitNotReached(this.quota, target.item)

    const clientMessageId = randomUUID()

    const row = await this.outbox.create({
      kind: 'INTERACTIVE_BUTTON',
      clientMessageId,
      instanceId: target.instance.id,
      subscriptionItemId: input.subscriptionItemId,
      domainId: input.domainId,
      appCode: input.appCode,
      destination: normalizedPhone,
      text: input.body,
      entity: input.entity,
      entityId: input.entityId,
      buttonPayload: {
        body: input.body,
        header: input.header,
        footer: input.footer,
        buttons: input.buttons,
      },
      /**
       * Guardado para rastro, não para prefixo: botão não passa pelo preparo de
       * texto (ver `widget-outbound-queue`). Nulo no caminho dos robôs de
       * Bizproc, que não têm operador.
       */
      operatorBitrixUserId: input.operatorBitrixUserId ?? null,
    })

    /**
     * Depois do commit da row. Se o enfileiramento falhar, a intenção fica
     * `PENDING` no banco — visível para o alerta de pendência antiga e
     * recuperável — em vez de desaparecer.
     */
    await this.sendQueue.enqueue({ outboxId: row.id })

    return { clientMessageId, status: 'queued', destination: normalizedPhone }
  }
}
