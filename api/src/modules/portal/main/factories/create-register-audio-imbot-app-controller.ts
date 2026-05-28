import { Controller } from '@/shared/presentation/controller'
import { RegisterAudioImbotAppController } from '../../presentation/controllers/register-audio-imbot-app-controller'

export const createRegisterAudioImbotAppController = (): Controller => {
  return new RegisterAudioImbotAppController()
}
