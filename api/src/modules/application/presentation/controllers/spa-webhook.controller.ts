import { timingSafeEqual } from 'node:crypto'
import { Request } from 'express'
import z from 'zod'
import { env } from '@/config/env'
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

/**
 * `ONCRMDYNAMICITEMUPDATE_1142` → verbo `UPDATE` e SPA `1142`.
 *
 * **O sufixo é opcional**, e não por tolerância defensiva: o portal manda
 * `ONCRMDYNAMICITEMADD` puro, com a SPA só em `data[FIELDS][ENTITY_TYPE_ID]`. Exigir o
 * sufixo aqui fazia todo evento real cair no fallback e perder o verbo — que é o que
 * decide o despacho do provisionamento.
 */
const EVENT_PATTERN = /^ONCRMDYNAMICITEM(ADD|UPDATE|DELETE)(?:_(\d+))?$/i

/**
 * O verbo do evento.
 *
 * `UNKNOWN` sobrou para o payload em que **não há nome de evento reconhecível** — só
 * `data[FIELDS][ENTITY_TYPE_ID]`. Ele nunca despacha provisionamento: inferir `ADD` ali
 * criaria instância que ninguém pediu, e o custo do contrário é só uma linha manual
 * esperando provisionamento — visível, e recuperável.
 */
type EventVerb = 'ADD' | 'UPDATE' | 'DELETE' | 'UNKNOWN'

type ParsedEvent = { entityTypeId: number; verb: EventVerb } | null

/**
 * O verbo era casado pela regex e descartado, porque toda invalidação é a mesma. Ele
 * passa a sair daqui: é o único sinal no payload que distingue **item que nasceu** de
 * item editado, e é por ele que o despacho de provisionamento é decidido.
 *
 * Verbo e `entityTypeId` são **eixos independentes**: o nome do evento carrega o verbo,
 * e a SPA vem do sufixo dele *ou* do campo do payload. Amarrar os dois — só aceitar o
 * verbo quando o sufixo viesse — era o que fazia `ONCRMDYNAMICITEMADD` sem sufixo virar
 * `UNKNOWN` e não provisionar nada.
 */
function parseEvent(
  event: string | undefined,
  fallback: string | number | undefined,
): ParsedEvent {
  const match = event ? EVENT_PATTERN.exec(event.trim()) : null

  const verb: EventVerb = match
    ? (match[1]!.toUpperCase() as Exclude<EventVerb, 'UNKNOWN'>)
    : 'UNKNOWN'

  // O sufixo do evento tem precedência sobre o campo: quando os dois vêm, é o nome do
  // evento que diz a qual binding o Bitrix está entregando.
  const fromSuffix = match?.[2] ? Number(match[2]) : NaN
  const entityTypeId = Number.isInteger(fromSuffix)
    ? fromSuffix
    : Number(fallback)

  return Number.isInteger(entityTypeId) && entityTypeId > 0
    ? { entityTypeId, verb }
    : null
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
 * Enfileira o provisionamento de um item criado à mão na SPA de itens.
 *
 * Dependência de **função**, não do caso de uso: é o que mantém o módulo `payments` sem
 * dependência do `thinkzap`, onde o provisionamento vive. O controller sabe que existe
 * uma fila; não sabe o que ela faz.
 */
export type EnqueueSpaItemProvisioning = (job: {
  itemId: string
  traceKey: string
}) => Promise<unknown>

/**
 * Recebe o webhook de saída das SPAs de billing e traduz o evento em invalidação de
 * cache — e, na criação de item de assinatura, no provisionamento do conector dele.
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
    private readonly enqueueProvisioning: EnqueueSpaItemProvisioning,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    console.log(req)
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

    const parsedEvent = parseEvent(event, fields?.ENTITY_TYPE_ID)
    if (parsedEvent === null) {
      apiLogger.warn(
        { app: 'payments', event },
        'Webhook da SPA sem entityTypeId reconhecível — ignorando',
      )

      return this.ok({ handled: false })
    }

    const { entityTypeId, verb } = parsedEvent
    const itemId = fields?.ID === undefined ? undefined : String(fields.ID)

    const result = await this.invalidate.execute({ entityTypeId, itemId })

    /**
     * O despacho vem **depois** da invalidação, e a ordem não é estética: o job relê o
     * item do Bitrix e escreve credencial nele. Enfileirar antes deixaria o worker
     * correndo contra uma entrada de cache velha da própria SPA que ele acabou de ler.
     */
    await this.dispatchProvisioning({ entityTypeId, verb, itemId, event })

    return this.ok(result)
  }

  /**
   * Enfileira o provisionamento quando, e só quando, um item de assinatura **nasceu**.
   *
   * `UPDATE` não despacha: trocar o provider de um item já provisionado é destruir um
   * recurso e criar outro, com QR code novo para o cliente — operação própria, não efeito
   * colateral de editar campo. `DELETE` também não: cancelar linha é `status:
   * 'cancelled'`, e o ciclo de desassinatura tem dono em `ProviderResourceBilling`.
   */
  private async dispatchProvisioning(args: {
    entityTypeId: number
    verb: EventVerb
    itemId: string | undefined
    event: string | undefined
  }): Promise<void> {
    if (args.verb !== 'ADD') return
    if (args.entityTypeId !== env.payments.spa.subscriptionItemEntityType)
      return

    if (!args.itemId) {
      apiLogger.warn(
        { app: 'payments', event: args.event },
        'Criação de item de assinatura sem id — nada a provisionar',
      )
      return
    }

    try {
      await this.enqueueProvisioning({
        itemId: args.itemId,
        traceKey: `spa-item-${args.itemId}`,
      })
    } catch (error) {
      /**
       * Falha de enfileiramento responde **200**, pela mesma razão que a falha de
       * invalidação responde: o Bitrix desativa handler que erra em sequência, e um
       * handler desativado é falha silenciosa que só aparece semanas depois. O item fica
       * pendente de provisionamento, e é este log que nomeia isso.
       */
      apiLogger.error(
        { app: 'payments', itemId: args.itemId, err: error },
        'Não foi possível enfileirar o provisionamento do item — item criado à mão fica pendente',
      )
    }
  }
}
