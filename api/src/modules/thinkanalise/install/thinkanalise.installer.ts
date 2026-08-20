import type { AppInstaller } from '@/shared/domain/app-installer'

export const THINKANALISE_APP_CODE_ID = 'crmthink.thinkanalise'

/**
 * O ThinkAnalise não registra nada no portal do cliente: não tem robô, conector,
 * placement nem evento. O installer existe vazio de propósito — sem ele não dá
 * para distinguir "não precisa registrar nada" de "esqueceram de registrar".
 */
export class ThinkanaliseInstaller implements AppInstaller {
  readonly appCode = THINKANALISE_APP_CODE_ID

  async install(): Promise<void> {
    // Intencionalmente vazio. Ver comentário da classe.
  }
}
