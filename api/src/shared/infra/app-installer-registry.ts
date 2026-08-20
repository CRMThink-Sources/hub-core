import type { AppInstaller } from '@/shared/domain/app-installer'

export class DuplicateAppInstallerError extends Error {
  constructor(appCode: string) {
    super(`Já existe um AppInstaller registrado para "${appCode}"`)
    this.name = 'DuplicateAppInstallerError'
  }
}

/**
 * Mapa `appCode → AppInstaller`. Substitui o `BitrixInstallBindRegistry`, que
 * devolvia listas de binds; aqui o registry só resolve quem instala o quê.
 */
export class AppInstallerRegistry {
  private readonly installers = new Map<string, AppInstaller>()

  /**
   * Lança em `appCode` duplicado. Como o registro acontece na subida da
   * aplicação, um installer sobrescrevendo o outro vira erro de boot em vez de
   * um app silenciosamente instalando o que não devia.
   */
  register(installer: AppInstaller): void {
    if (this.installers.has(installer.appCode)) {
      throw new DuplicateAppInstallerError(installer.appCode)
    }

    this.installers.set(installer.appCode, installer)
  }

  /** `undefined` quando o app não registra nada no portal. */
  get(appCode: string): AppInstaller | undefined {
    return this.installers.get(appCode)
  }
}
