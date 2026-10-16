import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  DailyLimitPolicy,
  isValidDailyAmount,
} from '@/modules/thinkzap/domain/daily-send-limit'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import type { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { thinkzapError } from '@/modules/thinkzap/errors/catalog'
import { classifyProviderSendFailure } from '@/modules/thinkzap/infra/adapters/classify-provider-send-failure'
import { AppError } from '@/shared/domain/errors/app-error'

export type DailyLimitPolicyInput = {
  provider: ConnectorProvider
  /** `zApiInstanceId` da linha — o mesmo id em todos os caminhos de envio. */
  lineKey?: string | null
  settings?: Pick<ConnectorSettings, 'dailyLimitEnabled' | 'dailyLimit'> | null
}

/**
 * A política de cota de uma linha. `null` = a linha não tem cota (oficial), e o
 * envio segue sem tocar no Redis.
 *
 * Só a linha não oficial: é ela que o WhatsApp bloqueia por volume. A oficial tem os
 * limites da própria Meta.
 *
 * Settings ausentes contam como limite desligado — a linha Z-API **continua sendo
 * contada**, para que o uso do dia apareça antes da ativação.
 */
export function dailyLimitPolicyOf(
  input: DailyLimitPolicyInput,
): DailyLimitPolicy | null {
  if (input.provider !== ConnectorProvider.ZAPI) return null
  if (!input.lineKey) return null

  const limit = input.settings?.dailyLimit
  const enabled =
    input.settings?.dailyLimitEnabled === true && isValidDailyAmount(limit)

  return {
    lineKey: input.lineKey,
    enabled,
    limit: enabled ? limit : 0,
  }
}

export function isDailyLimitReachedError(err: unknown): boolean {
  return (
    err instanceof AppError &&
    err.errorCode === 'thinkzap.line.daily_limit_reached'
  )
}

/**
 * Reserva a vaga, envia e acerta a contagem pelo desfecho:
 *
 * - sucesso: a vaga fica;
 * - o provider **respondeu** com erro: nada saiu, a vaga volta;
 * - sem resposta (timeout, rede): a entrega é incerta e a vaga fica — na dúvida,
 *   conta a mais em vez de deixar passar volume;
 * - recusa por limite: lança `thinkzap.line.daily_limit_reached` **sem chamar o
 *   provider**.
 *
 * Com `policy` nula, só envia.
 */
export async function sendWithinDailyQuota<T>(
  quota: DailySendQuota,
  policy: DailyLimitPolicy | null,
  send: () => Promise<T>,
  now: Date = new Date(),
): Promise<T> {
  if (!policy) return send()

  const result = await quota.reserve(policy, now)
  if (result.status === 'refused') {
    throw thinkzapError('thinkzap.line.daily_limit_reached', {
      lineKey: policy.lineKey,
      sentToday: result.counts.sent,
      effectiveLimit: result.effectiveLimit,
    })
  }

  try {
    return await send()
  } catch (err) {
    if (classifyProviderSendFailure(err) === 'refused') {
      await result.reservation.release()
    }
    throw err
  }
}

/**
 * Recusa cedo, no enfileiramento, quando a linha já atingiu o limite do dia: o
 * operador recebe o erro no clique em vez de uma falha na timeline minutos depois.
 *
 * Só lê — não reserva. A garantia do limite é a reserva no despacho, porque a fila
 * pode consumir a vaga entre este momento e aquele.
 */
export async function assertDailyLimitNotReached(
  quota: DailySendQuota | null | undefined,
  item: SubscriptionItem,
  now: Date = new Date(),
): Promise<void> {
  if (!quota || item.metadata.provider !== 'ZAPI') return

  const policy = dailyLimitPolicyOf({
    provider: ConnectorProvider.ZAPI,
    lineKey: item.metadata.zApiInstanceId,
    settings: item.settings,
  })

  if (policy && (await quota.wouldRefuse(policy, now))) {
    throw thinkzapError('thinkzap.line.daily_limit_reached')
  }
}
