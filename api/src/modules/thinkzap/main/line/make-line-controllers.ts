import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { GetLineConnection } from '@/modules/thinkzap/application/get-line-connection'
import { GetLineSettings } from '@/modules/thinkzap/application/get-line-settings'
import { UpdateLineSettings } from '@/modules/thinkzap/application/update-line-settings'
import { RenameLineOnProviderUseCase } from '@/modules/thinkzap/application/rename-line-on-provider.use-case'
import { UpdateConnectorEventBindsUseCase } from '@/modules/thinkzap/application/update-connector-event-binds.use-case'
import { ZApiInstanceGateway } from '@/modules/thinkzap/infra/persistence/gateway/instance.gateway'
import { GetLineConnectionController } from '@/modules/thinkzap/presentation/controllers/line/get-line-connection.controller'
import { GetLineQrCodeController } from '@/modules/thinkzap/presentation/controllers/line/get-line-qr-code.controller'
import { DisconnectLineController } from '@/modules/thinkzap/presentation/controllers/line/disconnect-line.controller'
import { GetLineSettingsController } from '@/modules/thinkzap/presentation/controllers/line/get-line-settings.controller'
import { UpdateLineSettingsController } from '@/modules/thinkzap/presentation/controllers/line/update-line-settings.controller'
import { LinkLineChannelController } from '@/modules/thinkzap/presentation/controllers/line/link-line-channel.controller'
import { UnlinkLineChannelController } from '@/modules/thinkzap/presentation/controllers/line/unlink-line-channel.controller'
import { makeLineDeps } from './make-line-deps'

export const makeGetLineConnectionController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeLineDeps()

  return new GetLineConnectionController(
    new GetLineConnection(getAplicationContext, zApiClient),
  )
}

export const makeGetLineQrCodeController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeLineDeps()

  return new GetLineQrCodeController(getAplicationContext, zApiClient)
}

export const makeDisconnectLineController = (): Controller => {
  const { getAplicationContext, instanceRepository, zApiClient } =
    makeLineDeps()

  return new DisconnectLineController(
    getAplicationContext,
    instanceRepository,
    zApiClient,
  )
}

export const makeGetLineSettingsController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeLineDeps()

  return new GetLineSettingsController(
    new GetLineSettings(getAplicationContext, zApiClient),
  )
}

export const makeUpdateLineSettingsController = (): Controller => {
  const { getAplicationContext, subscriptionItems, zApiClient } = makeLineDeps()

  const updateLineSettings = new UpdateLineSettings(
    new RenameLineOnProviderUseCase(new ZApiInstanceGateway(zApiClient)),
    new UpdateConnectorEventBindsUseCase(),
    subscriptionItems,
  )

  return new UpdateLineSettingsController(
    getAplicationContext,
    updateLineSettings,
  )
}

/**
 * Canal aberto usa o cliente Bitrix **do portal do cliente** (`makeBitrixClient`
 * resolve pela credencial da instalação), não o interno da CRMThink: o canal a
 * ativar vive no CRM do cliente.
 */
export const makeLinkLineChannelController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext, subscriptionItems, instanceRepository } =
    makeLineDeps()

  return new LinkLineChannelController(
    getAplicationContext,
    subscriptionItems,
    instanceRepository,
    await makeBitrixClient(req),
  )
}

export const makeUnlinkLineChannelController = async (
  req: Request,
): Promise<Controller> => {
  const { getAplicationContext, subscriptionItems, instanceRepository } =
    makeLineDeps()

  return new UnlinkLineChannelController(
    getAplicationContext,
    subscriptionItems,
    instanceRepository,
    await makeBitrixClient(req),
  )
}
