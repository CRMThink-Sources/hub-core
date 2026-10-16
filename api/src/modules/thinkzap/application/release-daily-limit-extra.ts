import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import {
  DailyLimitUsage,
  computeDailyLimitUsage,
  isValidDailyAmount,
} from '@/modules/thinkzap/domain/daily-send-limit'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'
import { assertConnectorLineEnabled } from './helpers/resolve-line-by-subscription-item'

export type ReleaseDailyLimitExtraInput = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  amount: number
}

/**
 * Libera mensagens extras **só para hoje** numa linha não oficial (Z-API) com limite ligado.
 *
 * Soma, não substitui: duas liberações no mesmo dia acumulam. O extra vive na chave
 * do dia, então a virada do dia o descarta sem ação nenhuma.
 *
 * Lê o limite do settings **gravado**: ligar o toggle na tela sem salvar não libera
 * nada, e é por isso que a ação fica desabilitada até salvar.
 */
export class ReleaseDailyLimitExtra {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly quota: DailySendQuota,
  ) {}

  async execute(input: ReleaseDailyLimitExtraInput): Promise<DailyLimitUsage> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    const now = new Date()
    // Liberar é escrita: linha bloqueada recusa, como os demais ajustes.
    const item = assertConnectorLineEnabled(
      context,
      input.subscriptionItemId,
      now,
    )

    if (
      item.metadata.provider !== 'ZAPI' ||
      !isValidDailyAmount(input.amount)
    ) {
      throw thinkzapError('thinkzap.line.daily_limit_invalid')
    }

    const { dailyLimitEnabled, dailyLimit } = item.settings
    if (!dailyLimitEnabled || !isValidDailyAmount(dailyLimit)) {
      throw thinkzapError('thinkzap.line.daily_limit_disabled')
    }

    const counts = await this.quota.addExtra(
      item.metadata.zApiInstanceId,
      input.amount,
      now,
    )

    return computeDailyLimitUsage({
      enabled: dailyLimitEnabled,
      limit: dailyLimit,
      ...counts,
    })
  }
}
