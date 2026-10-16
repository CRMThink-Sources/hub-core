import { Request } from 'express'
import { z } from 'zod'
import { Controller } from '@/shared/presentation/controller'
import { httpResponse } from '@/shared/helpers/http'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { queryLogs } from '@/shared/infra/loki-query.service'
import type { LogApp } from '@/shared/infra/logger'

// Teto do Loki (max_entries_limit_per_query default). Traz "tudo" do período
// até esse limite; a paginação é client-side.
const DEFAULT_LIMIT = 5000
const MAX_LIMIT = 5000
// Abaixo do max_query_length default (~721h) do Loki.
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000

// appCodeId do token (= availableApp.id, valores de appIdResolver). Fixo, não
// depende de env.appCodes (que pode ser sobrescrito por env var).
const APP_CODE_BY_LABEL: Partial<Record<LogApp, string>> = {
  thinkzap: 'crmthink.thinkzap',
  thinkanalise: 'crmthink.thinkanalise',
  importsheet: 'crmthink.importsheet',
  clicksign: 'crmthink.clicksign2',
}

const querySchema = z
  .object({
    start: z.coerce.number().int().positive(),
    end: z.coerce.number().int().positive(),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_LIMIT)
      .catch(DEFAULT_LIMIT)
      .default(DEFAULT_LIMIT),
    search: z.string().trim().max(200).optional(),
  })
  .refine(v => v.end > v.start, { message: 'end deve ser maior que start' })
  .refine(v => v.end - v.start <= MAX_RANGE_MS, {
    message: 'janela máxima excedida (31 dias)',
  })

// app e domínio vêm do servidor (rota + token); o cliente só passa janela/limit/busca.
export class GetLogsController extends Controller {
  constructor(
    private readonly appLabel: LogApp,
    private readonly domainRepository: GetDomainRepository,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const domainId = req.domainId
    if (!domainId) {
      return this.unauthorized(new Error('Domínio não resolvido no token'))
    }

    // Token tem de ser do mesmo app da rota (evita ler logs de outro app do domínio).
    const expectedAppCode = APP_CODE_BY_LABEL[this.appLabel]
    if (expectedAppCode && req.appId !== expectedAppCode) {
      return { status: 403, result: { error: 'App não autorizado' } }
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return this.badRequest(new Error(parsed.error.issues[0]?.message))
    }

    const domain = await this.domainRepository.getDomainById(domainId)
    if (!domain) {
      return this.notFound(new Error('Domínio não encontrado'))
    }

    const logs = await queryLogs({
      appLabel: this.appLabel,
      domain: domain.name,
      startMs: parsed.data.start,
      endMs: parsed.data.end,
      limit: parsed.data.limit,
      search: parsed.data.search,
    })

    // Bateu o teto → provável truncamento; UI avisa pra estreitar o período.
    return this.ok({
      logs,
      count: logs.length,
      truncated: logs.length >= MAX_LIMIT,
    })
  }
}
