import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { NotifyRecipientsService } from '@/shared/application/notify-recipients.service'
import { IMPORTSHEET_NOTIFY_OPTION_KEY } from '../importsheet.constants'

// Prefixo histórico do cache — mantido pra não invalidar chaves já gravadas.
const CACHE_PREFIX = 'importsheet:notify:'

/**
 * Lista de usuários a notificar do ImportSheet. Wrapper do serviço genérico
 * (`NotifyRecipientsService`) com a key/cache fixos deste app.
 */
export class NotifySettingsService extends NotifyRecipientsService {
  constructor(appOption: BitrixAppOptionService, appId: string) {
    super(appOption, appId, {
      optionKey: IMPORTSHEET_NOTIFY_OPTION_KEY,
      cachePrefix: CACHE_PREFIX,
    })
  }
}
