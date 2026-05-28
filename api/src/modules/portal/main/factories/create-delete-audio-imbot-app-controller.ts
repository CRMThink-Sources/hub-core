import { Controller } from '@/shared/presentation/controller'
import { DeleteAudioImbotAppController } from '../../presentation/controllers/delete-audio-imbot-app-controller'

export const createDeleteAudioImbotAppController = (): Controller => {
  return new DeleteAudioImbotAppController()
}
