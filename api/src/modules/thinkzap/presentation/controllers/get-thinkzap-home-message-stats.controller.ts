import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import {
  CountByInstanceAndSource,
  getThinkzapHomeMessageStats,
} from '@/modules/thinkzap/application/get-thinkzap-home-message-stats'

/** Ver `thinkzap-message-stats` (`openspec/specs`): limite de produto, não técnico. */
const MAX_RANGE_MONTHS = 6

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

const schema = z
  .object({
    domainId: z.string().min(1),
    appCode: z.string().min(1),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine(input => input.from.getTime() <= input.to.getTime(), {
    message: '`from` deve ser anterior ou igual a `to`',
    path: ['from'],
  })
  .refine(
    input =>
      input.to.getTime() <= addMonths(input.from, MAX_RANGE_MONTHS).getTime(),
    {
      message: `Período máximo de ${MAX_RANGE_MONTHS} meses entre \`from\` e \`to\``,
      path: ['to'],
    },
  )

/**
 * `GET /api/thinkzap/home/message-stats` — contagem de mensagens enviadas e
 * recebidas por provider, agregada por domínio, para a home do ThinkZap.
 *
 * A instalação vem do JWT (`domainId`/`appCode`), igual às demais rotas do
 * módulo — não do corpo/query, para o chamador não escolher o escopo.
 */
export class GetThinkzapHomeMessageStatsController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instanceRepo: GetInstanceRepository,
    private readonly messageRepo: CountByInstanceAndSource,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = schema.parse({
      domainId: req.domainId,
      appCode: req.appId,
      from: req.query.from,
      to: req.query.to,
    })

    const stats = await getThinkzapHomeMessageStats({
      domainId: input.domainId,
      appCode: input.appCode,
      from: input.from,
      to: input.to,
      getAplicationContext: this.getAplicationContext,
      instanceRepo: this.instanceRepo,
      messageRepo: this.messageRepo,
    })

    return this.ok(stats)
  }
}
