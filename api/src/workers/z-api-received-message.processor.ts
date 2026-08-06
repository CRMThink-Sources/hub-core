import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { ProcessZApiInboundMessageUseCase } from '@/modules/thinkzap/application/process-z-api-inbound-message.use-case'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeDisconnectExpiredLine } from '@/modules/thinkzap/main/make-disconnect-expired-line'

export async function processZApiReceivedMessage(event: ReceivedMessageEvent) {
  const useCase = new ProcessZApiInboundMessageUseCase(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    new PrismaDomainRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaCredentialRepository(),
    new PrismaThinkzapMessageRepository(),
    makeDisconnectExpiredLine(),
  )

  await useCase.execute(event)
}
