import { z } from 'zod'
import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { CreateImportService } from '../../application/create-import.service'

const responsibleSchema = z.object({
  columnIndex: z.number().int().nonnegative(),
  matchBy: z.enum(['id', 'email', 'phone']),
})

const mappingSchema = z.object({
  columnIndex: z.number().int().nonnegative(),
  columnLabel: z.string(),
  fieldName: z.string().min(1),
  isIdentifier: z.boolean(),
})

const configSchema = z.object({
  source: z.object({
    spreadsheetId: z.string().min(1),
    spreadsheetName: z.string(),
    tab: z.object({
      sheetId: z.number().int(),
      title: z.string(),
    }),
  }),
  target: z.object({
    entityCode: z.enum(['LEAD', 'DEAL', 'CONTACT', 'COMPANY', 'SPA', 'TASK', 'FEED']),
    entityTypeId: z.number().int().nullable(),
    categoryId: z.number().int().nullable(),
  }),
  responsible: responsibleSchema.nullable(),
  options: z.object({
    createContact: z.boolean(),
    createCompany: z.boolean(),
  }),
  mappings: z.array(mappingSchema),
})

const scheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('manual') }),
  z.object({ mode: z.literal('hours'), everyHours: z.number().int().min(1).max(23) }),
  z.object({ mode: z.literal('days'), weekdays: z.array(z.number().int().min(0).max(6)).min(1) }),
])

const bodySchema = z.object({
  title: z.string().min(1).max(191),
  schedule: scheduleSchema,
  config: configSchema,
})

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

    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(new Error(parsed.error.issues[0]?.message ?? 'Invalid payload'))
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(appId, domainId)
    if (!app) return this.notFound(new Error('App not found'))

    const { title, schedule, config } = parsed.data

    const created = await this.createImport.execute({
      appId: app.id,
      title,
      schedule,
      config,
    })

    return this.ok({ import: { id: created.id, title: created.title, createdAt: created.createdAt } })
  }
}
