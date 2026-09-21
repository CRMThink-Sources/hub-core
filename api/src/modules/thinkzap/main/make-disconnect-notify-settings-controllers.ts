import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { makeBitrixClient } from '@/shared/main/make-bitrix-client'
import { GetDisconnectNotifySettingsController } from '../presentation/controllers/get-disconnect-notify-settings.controller'
import { UpdateDisconnectNotifySettingsController } from '../presentation/controllers/update-disconnect-notify-settings.controller'

export const makeGetDisconnectNotifySettingsController = async (
  req: Request,
): Promise<Controller> => {
  const bitrixClient = await makeBitrixClient(req)
  return new GetDisconnectNotifySettingsController(bitrixClient)
}

export const makeUpdateDisconnectNotifySettingsController = async (
  req: Request,
): Promise<Controller> => {
  const bitrixClient = await makeBitrixClient(req)
  return new UpdateDisconnectNotifySettingsController(bitrixClient)
}
