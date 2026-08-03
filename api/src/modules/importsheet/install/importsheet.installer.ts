import type { AppInstaller } from '@/shared/domain/app-installer'

export const IMPORTSHEET_APP_CODE_ID = 'crmthink.importsheet'

/**
 * O ImportSheet não registra nada no portal do cliente: a integração dele é com
 * o Google, autorizada depois da instalação. O installer existe vazio de
 * propósito — sem ele não dá para distinguir "não precisa registrar nada" de
 * "esqueceram de registrar".
 */
export class ImportsheetInstaller implements AppInstaller {
  readonly appCode = IMPORTSHEET_APP_CODE_ID

  async install(): Promise<void> {
    // Intencionalmente vazio. Ver comentário da classe.
  }
}
