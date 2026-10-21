import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import {
  DailyLimitUsage,
  computeDailyLimitUsage,
} from '@/modules/thinkzap/domain/daily-send-limit'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { assertConnectorLineEnabled } from './helpers/resolve-line-by-subscription-item'

export type ResetDailyLimitUsageInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  /** Do JWT: quem zerou, para o registro. */
  bitrixUserId?: string
}

/**
 * Zera o uso **de hoje** de uma linha não oficial (Z-API): a contagem e os extras do
 * dia. A linha volta a enviar até o limite configurado, como se o dia tivesse virado.
 * A configuração do limite (ligado e valor) não muda.
 *
 * Vale com o limite ligado ou desligado: a contagem existe nos dois casos.
 */
export class ResetDailyLimitUsage {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly quota: DailySendQuota,
  ) {}

  async execute(input: ResetDailyLimitUsageInput): Promise<DailyLimitUsage> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const now = new Date()
    // Zerar é escrita: linha bloqueada recusa, como os demais ajustes.
    const item = assertConnectorLineEnabled(
      context,
      input.subscriptionItemId,
      now,
    )
    if (item.metadata.provider !== 'ZAPI') {
      throw thinkzapError('thinkzap.line.daily_limit_invalid')
    }

    const lineKey = item.metadata.zApiInstanceId
    const before = await this.quota.resetDay(lineKey, now)

    // Quem zerou e o que havia: zerar libera volume, e o suporte precisa ver isso.
    apiLogger.info(
      {
        app: 'thinkzap',
        subscriptionItemId: item.id,
        lineKey,
        bitrixUserId: input.bitrixUserId,
        sentBefore: before.sent,
        extraBefore: before.extra,
      },
      'Uso de hoje do limite diário zerado pelo usuário',
    )

    return computeDailyLimitUsage({
      enabled: item.settings.dailyLimitEnabled,
      limit: item.settings.dailyLimit,
      sent: 0,
      extra: 0,
    })
  }
}
