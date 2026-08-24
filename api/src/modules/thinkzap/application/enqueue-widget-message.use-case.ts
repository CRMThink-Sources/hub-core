import { randomUUID } from 'node:crypto'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { assertLineConnected } from './helpers/assert-line-connected'
import { ensureLineInstance } from './helpers/ensure-line-instance'
import {
  assertLineEnabled,
  findLineInContext,
} from './helpers/resolve-line-by-subscription-item'
import { SendWidgetMessageInput } from './send-widget-message.types'

export type EnqueueWidgetMessageResult = {
  clientMessageId: string
  status: 'queued'
  destination: string
}

/**
 * Aceita uma mensagem do widget e a torna **durável** antes de responder.
 *
 * A divisão com o worker é deliberada: aqui fica tudo que o operador resolve mudando
 * alguma coisa — linha bloqueada, provider errado, linha desconectada, telefone
 * inválido. Essas recusas continuam chegando na tela no momento do clique, porque
 * retentativa não melhora nenhuma delas e transformá-las em falha assíncrona tiraria do
 * operador os erros que ele consegue consertar.
 *
 * O que vai para o worker é o que o tempo resolve: o envio ao provider e os efeitos
 * colaterais. Antes desta change eles moravam no request, e qualquer `500` transitório
 * da Z-API perdia a mensagem — o operador via um erro e, se não reenviasse na hora,
 * ninguém reenviava por ele.
 *
 * `getPhoneData` saiu daqui de propósito: era uma ida à rede **antes** do envio, usada
 * só para compor o texto do comentário de timeline. Agora o comentário é do worker.
 */
export class EnqueueWidgetMessageUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository,
    private readonly zApiClient: ZApiClient,
    private readonly outbox: PrismaWidgetOutboxRepository,
    private readonly sendQueue: WidgetSendQueue,
  ) {}

  async execute(
    input: SendWidgetMessageInput,
  ): Promise<EnqueueWidgetMessageResult> {
    const {
      subscriptionItemId,
      domainId,
      appCode,
      destination,
      message,
      entity,
      entityId,
      operatorBitrixUserId,
    } = input

    const text = message?.trim()
    if (!text) {
      throw new Error('Message is required')
    }

    const context = await this.getAplicationContext.execute({
      domainId,
      appCode,
    })

    assertLineEnabled(context, subscriptionItemId, new Date())

    const line = findLineInContext(context, subscriptionItemId)

    await assertLineConnected(this.zApiClient, line, subscriptionItemId)

    const normalizedPhone = normalizePhoneNumber(destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      throw new Error('Invalid destination phone number')
    }

    /**
     * A âncora de `Instance` nasce aqui, e não no worker: a row de outbox tem chave
     * estrangeira para `Instance.id`. Depois de todas as recusas, para que um envio
     * recusado não deixe row para trás.
     */
    const instance = await ensureLineInstance(
      line.item,
      domainId,
      this.instances,
    )

    const clientMessageId = randomUUID()

    /**
     * **A gravação que torna esta change o que ela é.** A intenção existe no banco antes
     * de qualquer chamada ao provider, então a retentativa do worker tem como
     * distinguir "já entreguei" de "nunca entreguei". Enfileirar sem isto seria só uma
     * forma mais lenta de duplicar mensagem.
     */
    const row = await this.outbox.create({
      clientMessageId,
      instanceId: instance.id,
      subscriptionItemId,
      domainId,
      appCode,
      destination: normalizedPhone,
      text,
      entity,
      entityId,
      /**
       * O operador vai na intenção, não no `text`: quem clicou só é conhecido aqui,
       * e a entrega — onde o prefixo é montado — acontece depois, em outro processo.
       * Gravar já prefixado contaminaria o espelho no canal aberto, o comentário de
       * timeline e o aviso de falha, que leem esta mesma coluna.
       */
      operatorBitrixUserId: operatorBitrixUserId ?? null,
    })

    /**
     * Depois do commit da row. Se o enfileiramento falhar, a intenção fica `PENDING` no
     * banco — visível para o alerta de pendência antiga e recuperável — em vez de
     * desaparecer. A ordem inversa perderia a mensagem exatamente como antes.
     */
    await this.sendQueue.enqueue({ outboxId: row.id })

    return { clientMessageId, status: 'queued', destination: normalizedPhone }
  }
}
