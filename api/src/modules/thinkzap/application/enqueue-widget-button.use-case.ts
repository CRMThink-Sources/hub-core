import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { EnqueueInteractiveButtonSendService } from './enqueue-interactive-button-send.service'
import {
  EnqueueWidgetButtonResult,
  SendWidgetButtonInput,
} from './send-widget-button.types'

/**
 * Aceita o envio de botões pelo widget e o torna **durável** antes de
 * responder — mirror de `EnqueueWidgetTemplateUseCase`.
 *
 * A mecânica em si vive em `EnqueueInteractiveButtonSendService`,
 * compartilhada com os dois robôs de Bizproc: as recusas e a ordem delas são
 * as mesmas nos três caminhos. Ao contrário do template, o widget aqui não
 * está restrito a um provider — o modo botões existe tanto para linha `ZAPI`
 * quanto `HUBMESSAGE`.
 */
export class EnqueueWidgetButtonUseCase {
  private readonly service: EnqueueInteractiveButtonSendService

  constructor(
    getAplicationContext: GetAplicationContext,
    instances: GetInstanceRepository & CreateInstanceRepository,
    zApiClient: ZApiClient,
    outbox: PrismaWidgetOutboxRepository,
    sendQueue: WidgetSendQueue,
    quota: DailySendQuota | null = null,
    cadence: SendCadence | null = null,
  ) {
    this.service = new EnqueueInteractiveButtonSendService(
      getAplicationContext,
      instances,
      zApiClient,
      outbox,
      sendQueue,
      quota,
      cadence,
    )
  }

  async execute(
    input: SendWidgetButtonInput,
  ): Promise<EnqueueWidgetButtonResult> {
    const target = await this.service.resolveTarget({
      subscriptionItemId: input.subscriptionItemId,
      domainId: input.domainId,
      appCode: input.appCode,
    })

    return this.service.enqueue(target, input)
  }
}
