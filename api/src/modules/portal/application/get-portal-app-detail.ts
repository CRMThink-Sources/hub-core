import type { AplicationMirrorReader } from '@/modules/application/domain/repositories/aplication.repository'
import type { PortalAppDetail } from '../domain/entities/portal-domain'
import { PortalAppNotFoundError } from '../domain/errors/portal-domain.errors'
import type { PortalAppReadRepository } from '../domain/repositories/portal-app-read.repository'
import { mirrorState, readMirrors } from './helpers/hydrate-portal-apps'

/**
 * Cabeçalho da tela de aplicação do backoffice: a instalação, o domínio dela e o estado
 * do espelho na SPA 1060.
 *
 * Existe à parte do detalhe do cliente porque aquele resolve o contrato de **todas** as
 * apps do domínio; o cabeçalho de uma app não precisa pagar isso. O contrato da app é
 * da aba Assinaturas.
 */
export class GetPortalAppDetail {
  constructor(
    private readonly apps: PortalAppReadRepository,
    private readonly mirrors: AplicationMirrorReader,
  ) {}

  async execute(appId: string): Promise<PortalAppDetail> {
    const app = await this.apps.findById(appId)

    if (!app) throw new PortalAppNotFoundError()

    const read = await readMirrors(
      app.spaId === null ? [] : [app.spaId],
      this.mirrors,
    )

    return {
      ...app,
      title: (app.spaId && read.titles.get(app.spaId)) || app.appName,
      mirror: mirrorState(app.spaId, read),
    }
  }
}
