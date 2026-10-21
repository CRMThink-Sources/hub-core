import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { apiLogger } from '@/shared/infra/logger'
import { BotOriginContext, isBotOriginContext } from './enqueue-bot-speech'
import type { WidgetSendOutcome } from './notify-widget-send-outcome'

export type BotDeliveryDeps = {
  /** O eco da fala no chat do canal aberto, pelo bot. */
  echo: (
    context: BotOriginContext,
    bitrixChatId: string,
    text: string,
  ) => Promise<void>
}

/**
 * Depois da entrega de uma fala do bot: o eco no chat do canal aberto, que é o
 * histórico que o operador lê ao assumir. Só agora, com a fala já no WhatsApp.
 * A fala do bot não é persistida em `ThinkzapMessage`, como no envio direto.
 *
 * Falha do eco só vai para o log: o contato já recebeu.
 */
export async function deliverBotSpeech(
  row: WidgetOutboxRecord,
  deps: BotDeliveryDeps,
): Promise<boolean> {
  if (row.origin !== 'BOT') return false
  if (!isBotOriginContext(row.originContext) || !row.bitrixChatId) return true

  try {
    await deps.echo(row.originContext, row.bitrixChatId, row.text)
  } catch (err) {
    logThinkzapError(
      apiLogger,
      'thinkzap.bot.echo_failed',
      { app: 'thinkzap', outboxId: row.id, chatId: row.bitrixChatId, err },
      { level: 'warn' },
    )
  }
  return true
}

/**
 * Fala que não saiu: não é ecoada, e o motivo fica no log do processamento — o bot
 * não tem operador para avisar.
 */
export function notifyBotOutcome(
  outcome: WidgetSendOutcome,
  row: WidgetOutboxRecord,
): Promise<void> {
  if (outcome === 'daily-limit') {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.daily_limit_reached',
      { app: 'thinkzap', outboxId: row.id, chatId: row.bitrixChatId },
      {
        level: 'warn',
        msg: 'Fala do bot não entregue: limite diário da linha atingido',
      },
    )
    return Promise.resolve()
  }
  apiLogger.warn(
    { app: 'thinkzap', outboxId: row.id, outcome },
    'Fala do bot não entregue pela fila',
  )

  return Promise.resolve()
}
