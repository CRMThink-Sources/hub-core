import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { ProcessZApiInboundMessageUseCase } from '@/modules/thinkzap/application/process-z-api-inbound-message.use-case'
import {
  noopJobLog,
  type AppendJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeDisconnectExpiredLine } from '@/modules/thinkzap/main/make-disconnect-expired-line'

/** Ver a nota em `processHubMessageReceivedMessage` sobre o port entrar pelo argumento. */
export async function processZApiReceivedMessage(
  event: ReceivedMessageEvent,
  deps: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
) {
  const useCase = new ProcessZApiInboundMessageUseCase(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    new PrismaDomainRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaCredentialRepository(),
    new PrismaThinkzapMessageRepository(),
    makeDisconnectExpiredLine(),
  )

  await useCase.execute(event, deps)
}
