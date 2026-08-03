import { ProcessHubMessageInboundMessageUseCase } from '@/modules/thinkzap/application/process-hubmessage-inbound-message.use-case'
import type { HubMessageWebhookMessage } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export async function processHubMessageReceivedMessage(
  message: HubMessageWebhookMessage,
) {
  const useCase = new ProcessHubMessageInboundMessageUseCase(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    new PrismaDomainRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaCredentialRepository(),
    new PrismaThinkzapMessageRepository(),
  )

  await useCase.execute(message)
}
