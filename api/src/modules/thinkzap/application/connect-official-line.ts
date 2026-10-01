import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { SyncLineConnectedField } from './sync-line-connected-field'
import { assertEnabledOfficialLineInContext } from './helpers/resolve-line-by-subscription-item'

export type ConnectOfficialLineInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  // Os três vêm do SDK `@hubmessage/connect` no iframe Bitrix.
  wabaId: string
  phoneId: string
  code: string
}

export type ConnectOfficialLineResult = {
  wabaId: string
  // `false`: canal conectou mas a WABA não foi gravada — templates recusam até existir.
  wabaRecorded: boolean
}

// Validação de linha bloqueada vem antes do connect para não gastar a autenticação Meta.
export class ConnectOfficialLine {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly hubMessageClient: HubMessageClient,
    private readonly items: SubscriptionItemRepository,
    private readonly syncConnected?: Pick<SyncLineConnectedField, 'execute'>,
  ) {}

  async execute(
    input: ConnectOfficialLineInput,
    now: Date = new Date(),
  ): Promise<ConnectOfficialLineResult> {
    // Falha de leitura sobe como 502: não é "linha não encontrada".
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const line = assertEnabledOfficialLineInContext(
      context,
      input.subscriptionItemId,
      now,
    )

    await this.hubMessageClient.connectChannel(line.channelId, {
      wabaId: input.wabaId,
      phoneId: input.phoneId,
      code: input.code,
      coexistence: false,
    })

    const wabaRecorded = await this.recordWaba(line, input.wabaId)
    await this.recordConnected(line)

    return { wabaId: input.wabaId, wabaRecorded }
  }

  // Não lança: o canal já conectou e o webhook `CONNECTED` regrava o campo.
  private async recordConnected(line: {
    channelId: string
    item: { id: string; connected?: boolean | null }
  }): Promise<void> {
    if (!this.syncConnected) return

    try {
      await this.syncConnected.execute({
        itemId: line.item.id,
        current: line.item.connected ?? null,
        connected: true,
      })
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.line.connected_flag_write_failed',
        {
          app: 'thinkzap',
          itemId: line.item.id,
          channelId: line.channelId,
          err: error,
        },
        {
          msg: 'Canal conectado e o campo Conectado não foi gravado no item da linha',
        },
      )
    }
  }

  // Não lança: o canal já conectou; a perda da WABA é reportada pelo `false`.
  private async recordWaba(
    line: { channelId: string; wabaId: string | null; item: { id: string } },
    wabaId: string,
  ): Promise<boolean> {
    if (line.wabaId === wabaId) return true

    try {
      // `metadata` é gravado como bloco na SPA: vai inteiro, sem spread.
      await this.items.updateSubscriptionItem(line.item.id, {
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: line.channelId,
          wabaId,
        },
      })

      return true
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.line.waba_persist_failed',
        {
          app: 'thinkzap',
          itemId: line.item.id,
          channelId: line.channelId,
          wabaId,
          err: error,
        },
        { level: 'error' },
      )

      return false
    }
  }
}
