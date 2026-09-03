import { ProcessHubMessageInboundMessageUseCase } from '@/modules/thinkzap/application/process-hubmessage-inbound-message.use-case'
import type { HubMessageWebhookMessage } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import {
  noopJobLog,
  type AppendJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeDisconnectExpiredLine } from '@/modules/thinkzap/main/make-disconnect-expired-line'

/**
 * `appendJobLog` entra pelo argumento, não pelo construtor do use case: o log é do
 * **job**, que existe por execução, e não uma dependência da regra de entrega. Mesma
 * forma de `processHubMessageDeliveryStatus` e `processBitrixReceivedMessage`.
 *
 * O default `noopJobLog` é o que mantém chamada fora da fila e teste existente
 * funcionando sem fornecer o port.
 */
export async function processHubMessageReceivedMessage(
  message: HubMessageWebhookMessage,
  deps: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
) {
  const useCase = new ProcessHubMessageInboundMessageUseCase(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    new PrismaDomainRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaCredentialRepository(),
    new PrismaThinkzapMessageRepository(),
    makeDisconnectExpiredLine(),
  )

  await useCase.execute(message, deps)
}
