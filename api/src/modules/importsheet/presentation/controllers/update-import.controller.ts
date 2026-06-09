import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { UpdateImportService } from '../../application/update-import.service'
import { importPayloadSchema } from './import-payload.schema'

export class UpdateImportController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly updateImport: UpdateImportService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId as string
    const domainId = req.domainId as string

    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return this.badRequest(new Error('Invalid id'))

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

    const { title, startRow, schedule, config } = parsed.data

    const updated = await this.updateImport.execute({
      id,
      appId: app.id,
      title,
      startRow,
      schedule,
      config,
    })
    if (!updated) return this.notFound(new Error('Import not found'))

    return this.ok({
      import: {
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt,
      },
    })
  }
}
