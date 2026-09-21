import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { NotifyRecipientsService } from '@/shared/application/notify-recipients.service'
import { THINKZAP_DISCONNECT_NOTIFY_OPTION_KEY } from '../thinkzap.constants'

const CACHE_PREFIX = 'thinkzap:disconnect-notify:'

/**
 * Lista de usuários a avisar quando uma linha Z-API do Thinkzap desconecta.
 * Wrapper do serviço genérico (`NotifyRecipientsService`) com a key/cache fixos
 * deste app — nunca reaproveitar as constantes do importsheet.
 */
export class ThinkzapDisconnectNotifySettingsService extends NotifyRecipientsService {
  constructor(appOption: BitrixAppOptionService, appId: string) {
    super(appOption, appId, {
      optionKey: THINKZAP_DISCONNECT_NOTIFY_OPTION_KEY,
      cachePrefix: CACHE_PREFIX,
    })
  }
}
