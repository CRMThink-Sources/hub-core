import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { listLinesForWidget } from '@/modules/thinkzap/application/list-lines-for-widget'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'

/**
 * A instalação vem do JWT, não da request. `req.appId` carrega o `appCodeId`, igual
 * ao que `parseLineRequest` consome nas rotas de linha.
 */
const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /thinkzap/connector/list` — as linhas da instalação.
 *
 * Lista pelos **itens de assinatura**, pela mesma função do handler de sessão:
 * `Connector` não recebe mais row para linha criada na SPA, e listar por ela
 * devolvia vazio para cliente com linha funcionando.
 *
 * Também conserta dois defeitos de entrada que só apareciam em runtime: a rota é
 * `GET` e o controller lia `req.body` (`z.parse` de `undefined`), e a condição de
 * guarda estava invertida — request com instalação válida caía no `else` e
 * respondia `400 Invalid request`.
 */
export class ListConnectorsController extends Controller {
  constructor(
    private readonly getApp: GetInstalledAppRepository,
    private readonly getAplicationContext: GetAplicationContext,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = schema.safeParse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    if (!parsed.success) {
      return this.badRequest(new Error('Instalação ausente no token'))
    }

    const { domainId, appCode } = parsed.data

    const app = await this.getApp.getByAppCodeAndDomainId(appCode, domainId)
    if (!app) {
      return this.badRequest(new Error('App not found'))
    }

    const domain = await new PrismaDomainRepository().getDomainById(domainId)
    if (!domain) {
      return this.badRequest(new Error('Domain not found'))
    }

    const connectors = await listLinesForWidget({
      appId: app.id,
      domainId,
      appCode,
      bitrix: await makeBitrixClientByDomainAndAppCoode(domain.name, appCode),
      getAplicationContext: this.getAplicationContext,
    })

    return this.ok({ connectors, total: connectors.length })
  }
}
