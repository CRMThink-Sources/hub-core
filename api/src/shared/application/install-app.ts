import { logger } from '@/shared/infra/logger'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import { AppInstallerRegistry } from '@/shared/infra/app-installer-registry'
import { Domain } from '@/shared/domain/entities/domain'
import { InstalledApp } from '@/shared/domain/entities/installed-app'
import { UpsertDomain } from './upsert-domain'
import { UpsertInstalledApp } from './upsert-installed-app'
import { UpsertCredential } from './upsert-credential'
import { GetOrCreateSpa } from './get-or-create-spa'
import { resolveBitrixTokenExpiresAt } from './resolve-bitrix-token-expires-at'

/**
 * Passos da instalação, na ordem em que rodam. O nome vai no log e na resposta
 * de erro — é como o suporte sabe onde a instalação parou.
 */
export type InstallStep =
  | 'resolve-app-code'
  | 'upsert-domain'
  | 'upsert-app'
  | 'upsert-credential'
  | 'resolve-spa-item'
  | 'link-spa-item'
  | 'run-installer'

/** Passos cuja falha vem do Bitrix, não do banco. Decide 502 vs 500. */
const BITRIX_STEPS: ReadonlySet<InstallStep> = new Set([
  'resolve-spa-item',
  'run-installer',
])

export class InstallStepError extends Error {
  constructor(
    readonly step: InstallStep,
    override readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'InstallStepError'
  }

  /** `true` quando a origem da falha é o Bitrix — o chamador mapeia para 502. */
  get isUpstream(): boolean {
    return BITRIX_STEPS.has(this.step)
  }
}

/** `resolve-app-code` não achou o app: o chamador mapeia para 404. */
export class AppCodeNotFoundError extends Error {
  constructor(appCode: string) {
    super(`App "${appCode}" não encontrado`)
    this.name = 'AppCodeNotFoundError'
  }
}

export type InstallAppInput = {
  domain: string
  memberId: string
  /** `core_app_codes.id`, já resolvido a partir do `app_code` do payload. */
  appCode: string
  email: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type InstallAppResult = {
  domain: Domain
  app: InstalledApp
  spaItemId: string
}

/**
 * Orquestra a instalação de um app num portal.
 *
 * A sequência é código linear, não configuração: ela é fixa, e ler o fluxo não
 * pode depender de seguir um runner genérico. Todo passo passa por `runStep`,
 * que cronometra, loga e reembrulha a exceção em `InstallStepError` — é o que dá
 * o nome do passo na resposta sem espalhar `try/catch` pelo corpo.
 *
 * Fail-fast de ponta a ponta: o primeiro passo que falhar aborta, e nada é
 * revertido. Reverter seria rollback distribuído entre MySQL e duas instâncias
 * do Bitrix; em vez disso todo passo é idempotente, e reenviar o mesmo payload
 * retoma do início sem duplicar dados.
 */
export class InstallApp {
  constructor(
    private readonly availableApps: GetAvailableAppRepository,
    private readonly upsertDomain: UpsertDomain,
    private readonly upsertInstalledApp: UpsertInstalledApp,
    private readonly upsertCredential: UpsertCredential,
    private readonly getOrCreateSpa: GetOrCreateSpa,
    private readonly aplications: AplicationRepository,
    private readonly installers: AppInstallerRegistry,
  ) {}

  async execute(input: InstallAppInput): Promise<InstallAppResult> {
    const log = { domain: input.domain, appCode: input.appCode }

    const availableApp = await this.runStep(
      log,
      'resolve-app-code',
      async () => {
        const app = await this.availableApps.getById(input.appCode)
        if (!app) throw new AppCodeNotFoundError(input.appCode)
        return app
      },
    )

    const domain = await this.runStep(log, 'upsert-domain', () =>
      this.upsertDomain.execute({
        name: input.domain,
        memberId: input.memberId,
      }),
    )

    const app = await this.runStep(log, 'upsert-app', () =>
      this.upsertInstalledApp.execute({
        domainId: domain.id,
        appCodeId: availableApp.id,
        email: input.email,
      }),
    )

    await this.runStep(log, 'upsert-credential', () =>
      this.upsertCredential.execute({
        appId: app.id,
        clientId: availableApp.code,
        clientSecret: availableApp.secret,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        // `expires_in` do Bitrix pode vir como TTL em segundos ou como epoch
        // (s ou ms). Converter na mão aqui produzia data em 1970.
        expiresAt: resolveBitrixTokenExpiresAt(input.expiresIn),
      }),
    )

    // Portal **interno** (SPA 1060). Vem antes do installer, que fala com o
    // portal do cliente: uma indisponibilidade nossa não deve deixar o portal
    // do cliente meio configurado.
    //
    // Nome, telefone e empresa **não** vão: o payload de instalação não os tem, e
    // são capturados na ativação do trial. Mandá-los como `''` — como esta chamada
    // fazia — apagaria numa reinstalação o contato que o comercial usa.
    const spa = await this.runStep(log, 'resolve-spa-item', () =>
      this.getOrCreateSpa.execute({
        appId: app.appCodeId,
        domain: input.domain,
        memberId: input.memberId,
        email: input.email,
      }),
    )

    const spaItemId = String(spa.id)

    await this.runStep(log, 'link-spa-item', () =>
      this.aplications.linkSpaItem(app.id, spaItemId),
    )

    await this.runStep(log, 'run-installer', async () => {
      const installer = this.installers.get(input.appCode)

      // App sem installer é caso normal, não erro: nem toda aplicação registra
      // algo no portal.
      if (!installer) return

      await installer.install({
        client: new BitrixRestClient(input.domain, input.accessToken),
        appCode: input.appCode,
        installedAppId: app.id,
        spaItemId,
        domain: input.domain,
        email: input.email,
        memberId: input.memberId,
      })
    })

    return { domain, app, spaItemId }
  }

  private async runStep<T>(
    log: { domain: string; appCode: string },
    step: InstallStep,
    run: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now()

    try {
      const result = await run()
      logger.info(
        { ...log, step, durationMs: Date.now() - startedAt },
        'install step ok',
      )
      return result
    } catch (error) {
      logger.error(
        { ...log, step, durationMs: Date.now() - startedAt, err: error },
        'install step failed',
      )
      throw new InstallStepError(step, error)
    }
  }
}
