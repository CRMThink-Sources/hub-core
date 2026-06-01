import {
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'

export class ImportSheetSessionHandler implements SessionHandler {
  appCode = 'crmthink.importsheet'

  // Sem dados de sessão por enquanto — só estrutura inicial.
  handlers: SessionHanderPerformer[] = []
}
