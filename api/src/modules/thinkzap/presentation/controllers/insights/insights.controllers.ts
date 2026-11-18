import { Request, Response } from 'express'
import { z } from 'zod'
import type { GetInsightsConfig } from '@/modules/thinkzap/application/insights/get-insights-config'
import type { GetInsightsDashboard } from '@/modules/thinkzap/application/insights/get-insights-dashboard'
import type { GetInsightsToday } from '@/modules/thinkzap/application/insights/get-insights-today'
import type { SaveInsightsConfig } from '@/modules/thinkzap/application/insights/save-insights-config'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { apiLogger } from '@/shared/infra/logger'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'

const READ_FAILED =
  'Não foi possível ler as conversas do Bitrix agora. Tente de novo em instantes.'

// O caso de uso monta `new Date(q.to + 'T23:59:59-03:00')`: só AAAA-MM-DD serve,
// e data inválida viraria exceção (500) lá dentro.
const isoDay = (label: string) =>
  z
    .string({ error: `Informe ${label} no formato AAAA-MM-DD.` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `Informe ${label} no formato AAAA-MM-DD.`)
    // O Date aceita 2026-02-31 e rola para março; só vale quem volta igual.
    .refine(v => {
      const d = new Date(v + 'T12:00:00Z')
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
    }, `Data inválida em ${label}.`)

const text = z.string({ error: 'Parâmetro de filtro inválido.' })
const textOrNumber = z.union([text, z.number()], {
  error: 'Parâmetro de filtro inválido.',
})

const dashboardQuerySchema = z
  .object({
    from: isoDay('o início do período').optional(),
    to: isoDay('o fim do período').optional(),
    dept: text.optional(),
    operator: text.optional(),
    slaMin: textOrNumber.optional(),
    sources: text.optional(),
    g: text.optional(),
    sg: text.optional(),
  })
  .refine(q => !q.from || !q.to || q.from <= q.to, {
    message: 'O início do período não pode ser depois do fim.',
  })

const todayQuerySchema = z.object({
  sources: text.optional(),
  alertMin: textOrNumber.optional(),
})

// Só garante que veio um objeto; chaves e limites são normalizados pelo
// `SaveInsightsConfig`, que é a fonte de verdade das regras.
const configBodySchema = z.record(z.string(), z.unknown(), {
  error: 'Envie a configuração como um objeto.',
})

/**
 * Leitura de painel: falha do Bitrix vira mensagem curta, sem repassar o corpo
 * da resposta (o `response` do BitrixError pode carregar dados do portal).
 */
abstract class InsightsReadController extends Controller {
  protected async guarded(run: () => Promise<unknown>): Promise<httpResponse> {
    try {
      return this.ok(await run())
    } catch (error) {
      if (
        error instanceof BitrixError ||
        error instanceof BitrixMethodPausedError
      ) {
        apiLogger.warn(
          { errorName: error.name, errorMessage: error.message },
          'Insights: falha ao ler conversas do Bitrix',
        )
        return this.badGateway(new Error(READ_FAILED))
      }
      throw error
    }
  }
}

export class GetInsightsDashboardController extends InsightsReadController {
  constructor(
    private readonly dashboard: Pick<GetInsightsDashboard, 'execute'>,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))
    const parsed = dashboardQuerySchema.safeParse(req.query ?? {})
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.'),
      )
    }
    return this.guarded(() => this.dashboard.execute(appId, parsed.data))
  }
}

export class GetInsightsTodayController extends InsightsReadController {
  constructor(private readonly today: Pick<GetInsightsToday, 'execute'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))
    const parsed = todayQuerySchema.safeParse(req.query ?? {})
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.'),
      )
    }
    return this.guarded(() => this.today.execute(appId, parsed.data))
  }
}

export class GetInsightsConfigController extends Controller {
  constructor(private readonly config: Pick<GetInsightsConfig, 'execute'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))
    return this.ok(await this.config.execute(appId))
  }
}

/** A restrição a admin é da rota (`requireThinkzapAdmin`), como na chave Vibecode. */
export class SaveInsightsConfigController extends Controller {
  constructor(private readonly save: Pick<SaveInsightsConfig, 'execute'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))
    const parsed = configBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return this.badRequest(
        new Error(
          parsed.error.issues[0]?.message ??
            'Envie a configuração como um objeto.',
        ),
      )
    }
    return this.ok(await this.save.execute(appId, parsed.data))
  }
}
