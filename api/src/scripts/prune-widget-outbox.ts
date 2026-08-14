import 'dotenv/config'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Limpeza por retenção do outbox do widget.
 *
 * **Só remove `SENT`.** `FAILED` e `UNKNOWN` ficam até alguém resolver: são exatamente
 * as rows que descrevem mensagem que o cliente do parceiro não recebeu, e apagá-las
 * apagaria a única evidência do problema. `PENDING` e `SENDING` também ficam — são
 * trabalho em aberto, e uma pendência antiga é sinal de fila parada, não lixo.
 *
 * **Os 30 dias são um default, não uma decisão tomada.** Precisa ser confirmado com
 * quem opera, olhando volume real: curto demais perde rastreabilidade para investigar
 * um relato antigo, longo demais deixa a tabela crescer sem uso. Ajustável por
 * `OUTBOX_RETENTION_DAYS` para que a escolha não exija deploy.
 *
 * Rodar por cron no host, como os outros scripts operacionais. Idempotente e seguro
 * para rodar quantas vezes quiser.
 */
const DEFAULT_RETENTION_DAYS = 30

async function main(): Promise<void> {
  const days = Number(
    process.env.OUTBOX_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS,
  )

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(
      `OUTBOX_RETENTION_DAYS inválido: ${String(process.env.OUTBOX_RETENTION_DAYS)}`,
    )
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const outbox = new PrismaWidgetOutboxRepository()

  const deleted = await outbox.deleteSentOlderThan(cutoff)

  /**
   * Pendência antiga sai no mesmo log de propósito: quem roda a limpeza é quem repara
   * na fila, e um número diferente de zero aqui é fila parada — o sintoma que a task de
   * alertas desta change existe para pegar.
   */
  const stalePending = await outbox.countPendingOlderThan(
    new Date(Date.now() - 15 * 60 * 1000),
  )

  apiLogger.info(
    {
      app: 'thinkzap',
      retentionDays: days,
      cutoff: cutoff.toISOString(),
      deleted,
      stalePending,
    },
    'Limpeza do outbox do widget concluída',
  )

  if (stalePending > 0) {
    apiLogger.warn(
      { app: 'thinkzap', stalePending },
      'Há intenções de envio pendentes há mais de 15 minutos — conferir se o worker está de pé',
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    apiLogger.error({ app: 'thinkzap', err }, 'Falha na limpeza do outbox')
    process.exit(1)
  })
