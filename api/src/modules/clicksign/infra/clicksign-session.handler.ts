import {
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { CLICKSIGN_APP_CODE_ID } from '../clicksign.constants'

export class ClickSignSessionHandler implements SessionHandler {
  appCode = CLICKSIGN_APP_CODE_ID

  // Sem dados extras de sessão por ora. Adicionar performers quando houver.
  handlers: SessionHanderPerformer[] = []
}
