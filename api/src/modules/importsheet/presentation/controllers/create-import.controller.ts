import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { CreateImportService } from '../../application/create-import.service'
import { importPayloadSchema } from './import-payload.schema'

export class CreateImportController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly createImport: CreateImportService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId as string
    const domainId = req.domainId as string

    const parsed = importPayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Invalid payload'),
      )
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    const { title, schedule, config } = parsed.data

    const created = await this.createImport.execute({
      appId: app.id,
      title,
      schedule,
      config,
    })

    return this.ok({
      import: {
        id: created.id,
        title: created.title,
        createdAt: created.createdAt,
      },
    })
  }
}
