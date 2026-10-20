import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { MirrorZApiSentByMeMessageUseCase } from '@/modules/thinkzap/application/mirror-z-api-sent-by-me-message.use-case'
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
import { makeResolveContactIdentity } from '@/modules/thinkzap/main/make-resolve-contact-identity'
import { makeResolveGroupMentions } from '@/modules/thinkzap/main/make-resolve-group-mentions'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'

/** Mensagem enviada pelo próprio aparelho da linha (celular/WhatsApp Web). */
export async function processZApiSentByMeMessage(
  event: ReceivedMessageEvent,
  deps: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
) {
  const useCase = new MirrorZApiSentByMeMessageUseCase(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    new PrismaDomainRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaCredentialRepository(),
    new PrismaThinkzapMessageRepository(),
    makeDisconnectExpiredLine(),
    makeResolveContactIdentity(),
    makeResolveGroupMentions(),
    makeInstallationLocaleRepository(),
  )

  await useCase.execute(event, deps)
}
