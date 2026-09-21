import { Controller } from '@/shared/presentation/controller'
import { GetDisconnectNotifySettingsController } from '../presentation/controllers/get-disconnect-notify-settings.controller'
import { UpdateDisconnectNotifySettingsController } from '../presentation/controllers/update-disconnect-notify-settings.controller'

export const makeGetDisconnectNotifySettingsController = (): Controller =>
  new GetDisconnectNotifySettingsController()

export const makeUpdateDisconnectNotifySettingsController = (): Controller =>
  new UpdateDisconnectNotifySettingsController()
