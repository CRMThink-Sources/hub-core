import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { BitrixUserService } from '@/shared/application/bitrix-user.service'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { ClickSignBitrixFieldsService } from '../application/bitrix-fields.service'
import { ListFieldsController } from '../presentation/controllers/list-fields.controller'
import { ListUsersController } from '../presentation/controllers/list-users.controller'
import { GetSettingsController } from '../presentation/controllers/get-settings.controller'
import { UpdateSettingsController } from '../presentation/controllers/update-settings.controller'
import { SendEnvelopeController } from '../presentation/controllers/send-envelope.controller'
import { CancelDocumentController } from '../presentation/controllers/cancel-document.controller'
import { ClicksignWebhookController } from '../presentation/controllers/clicksign-webhook.controller'
import { VerifyProvisioningController } from '../presentation/controllers/verify-provisioning.controller'
import { RepairProvisioningController } from '../presentation/controllers/repair-provisioning.controller'
import { WebhookContext } from '../application/provisioning.service'
import { PrismaClickSignSettingsRepository } from '../infra/persistence/repositories/prisma-clicksign-settings.repository'

export const makeListFieldsController = async (
  req: Request,
): Promise<Controller> =>
  new ListFieldsController(
    new ClickSignBitrixFieldsService(await makeBitrixClient(req)),
  )

export const makeListUsersController = async (
  req: Request,
): Promise<Controller> =>
  new ListUsersController(new BitrixUserService(await makeBitrixClient(req)))

export const makeGetSettingsController = (_req: Request): Controller =>
  new GetSettingsController(
    new PrismaInstalledAppRepository(),
    new PrismaClickSignSettingsRepository(),
  )

export const makeUpdateSettingsController = async (
  req: Request,
): Promise<Controller> =>
  new UpdateSettingsController(
    new PrismaInstalledAppRepository(),
    new PrismaClickSignSettingsRepository(),
    await makeBitrixClient(req),
  )

// Rotas públicas (sem authMiddleware): auth vem no payload, resolve app por domain.
export const makeSendEnvelopeController = (_req: Request): Controller =>
  new SendEnvelopeController(
    new PrismaDomainRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaClickSignSettingsRepository(),
  )

export const makeCancelDocumentController = (_req: Request): Controller =>
  new CancelDocumentController(
    new PrismaDomainRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaClickSignSettingsRepository(),
  )

export const makeClicksignWebhookController = (_req: Request): Controller =>
  new ClicksignWebhookController(new PrismaClickSignSettingsRepository())

// Resolve o id do app instalado (req.appId é o appCode) para o check/repair de
// webhook por conta Clicksign.
const makeWebhookCtx = async (
  req: Request,
): Promise<WebhookContext | undefined> => {
  const appCodeId = req.appId as string | undefined
  const domainId = req.domainId as string | undefined
  if (!appCodeId || !domainId) return undefined
  const app = await new PrismaInstalledAppRepository().getByAppCodeAndDomainId(
    appCodeId,
    domainId,
  )
  if (!app) return undefined
  return { appId: app.id, settings: new PrismaClickSignSettingsRepository() }
}

export const makeVerifyProvisioningController = async (
  req: Request,
): Promise<Controller> =>
  new VerifyProvisioningController(
    await makeBitrixClient(req),
    await makeWebhookCtx(req),
  )

export const makeRepairProvisioningController = async (
  req: Request,
): Promise<Controller> =>
  new RepairProvisioningController(
    await makeBitrixClient(req),
    await makeWebhookCtx(req),
  )
