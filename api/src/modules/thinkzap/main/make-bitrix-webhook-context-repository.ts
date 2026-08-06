import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { GetBitrixWebhookContextRepository } from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { PrismaBitrixWebhookContextRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bitrix-webhook-context.repository'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'

/**
 * Fiação do contexto de webhook, compartilhada pelos três workers do caminho
 * Bitrix → WhatsApp (mensagem recebida, edição e exclusão).
 *
 * Existe para que a resolução por item não seja recabeada em três lugares — e para
 * que o repositório receba as dependências em vez de construí-las, o que o tornava
 * intestável.
 */
export const makeBitrixWebhookContextRepository =
  (): GetBitrixWebhookContextRepository =>
    new PrismaBitrixWebhookContextRepository(
      makeGetAplicationContext(),
      new PrismaInstanceRepository(),
    )
