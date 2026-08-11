import { timingSafeEqual } from 'node:crypto'
import { Request } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { apiLogger } from '@/shared/infra/logger'
import { InvalidateSpaCache } from '@/modules/application/application/invalidate-spa-cache'

/**
 * Payload do webhook de saída do Bitrix.
 *
 * Tudo é opcional de propósito: um payload incompleto tem que virar 200 com log, não
 * 400. O Bitrix desativa handler de evento que erra em sequência, e um handler
 * desativado é uma falha silenciosa que só aparece semanas depois como "o cache não
 * atualiza". A validação vira decisão de fluxo abaixo, não rejeição.
 *
 * Os campos chegam como formulário (`data[FIELDS][ID]`), e é o
 * `express.urlencoded({ extended: true })` que os transforma nesta árvore.
 */
const payloadSchema = z.object({
  event: z.string().optional(),
  data: z
    .object({
      FIELDS: z
        .object({
          ID: z.union([z.string(), z.number()]).optional(),
          ENTITY_TYPE_ID: z.union([z.string(), z.number()]).optional(),
        })
        .optional(),
    })
    .optional(),
  auth: z
    .object({
      application_token: z.string().optional(),
      domain: z.string().optional(),
    })
    .optional(),
})

/** `ONCRMDYNAMICITEMUPDATE_1142` → `1142`. */
const EVENT_PATTERN = /^ONCRMDYNAMICITEM(?:ADD|UPDATE|DELETE)_(\d+)$/i

function parseEntityTypeId(
  event: string | undefined,
  fallback: string | number | undefined,
): number | null {
  const match = event ? EVENT_PATTERN.exec(event.trim()) : null
  if (match) return Number(match[1])

  const parsed = Number(fallback)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Comparação de tempo constante entre o token recebido e o configurado.
 *
 * `timingSafeEqual` **lança** com buffers de tamanhos diferentes, então o
 * comprimento é checado antes — e é por isso que a diferença de tamanho vaza pelo
 * tempo, o que não importa: o que não pode vazar é qual byte divergiu num token do
 * mesmo tamanho.
 */
function tokenMatches(received: string, expected: string): boolean {
  const a = Buffer.from(received)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Recebe o webhook de saída das SPAs de billing e traduz o evento em invalidação de
 * cache.
 *
 * A rota é pública (sem JWT): quem chama é o Bitrix, não uma instalação. A
 * autenticação é o `application_token` do próprio payload — o webhook de saída não
 * assina o corpo, então não há HMAC a validar como no Stripe.
 *
 * Só duas respostas fogem de 200: token divergente (401) e segredo não configurado
 * (503). Todo o resto — evento de SPA que não é de billing, payload sem id, Redis
 * fora do ar — responde 200 com log, porque o pior caso de não invalidar é a entrada
 * morrer por TTL, que é o comportamento de antes deste endpoint existir.
 */
export class SpaWebhookController extends Controller {
  constructor(
    private readonly invalidate: InvalidateSpaCache,
    private readonly expectedToken: string,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    if (!this.expectedToken) {
      apiLogger.warn(
        { app: 'payments' },
        'BITRIX_SPA_WEBHOOK_TOKEN não configurado — webhook da SPA desabilitado',
      )

      return {
        status: 503,
        result: { error: 'SPA webhook not configured' },
      }
    }

    /**
     * Corpo que não casa com o schema não é rejeitado: vira objeto vazio, cai no
     * token que não confere (401) ou no evento irreconhecível (200). Um `throw` de
     * Zod aqui viraria 400 e ensinaria o Bitrix a desativar o handler.
     */
    const parsed = payloadSchema.safeParse(req.body)
    const payload: z.infer<typeof payloadSchema> = parsed.success
      ? parsed.data
      : {}

    if (
      !tokenMatches(payload.auth?.application_token ?? '', this.expectedToken)
    ) {
      apiLogger.warn(
        { app: 'payments', domain: payload.auth?.domain },
        'Webhook da SPA com application token inválido',
      )

      return this.unauthorized(new Error('Invalid application token'))
    }

    const event = payload.event
    const fields = payload.data?.FIELDS

    const entityTypeId = parseEntityTypeId(event, fields?.ENTITY_TYPE_ID)
    if (entityTypeId === null) {
      apiLogger.warn(
        { app: 'payments', event },
        'Webhook da SPA sem entityTypeId reconhecível — ignorando',
      )

      return this.ok({ handled: false })
    }

    const itemId = fields?.ID === undefined ? undefined : String(fields.ID)

    const result = await this.invalidate.execute({ entityTypeId, itemId })

    return this.ok(result)
  }
}
