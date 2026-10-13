import { timingSafeEqual } from 'node:crypto'
import { Request } from 'express'
import z from 'zod'
import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { apiLogger } from '@/shared/infra/logger'
import {
  InvalidateSpaCache,
  type EventVerb,
} from '@/modules/application/application/invalidate-spa-cache'

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
 * O verbo do evento vive em `invalidate-spa-cache.ts`: a invalidação passou a decidir
 * por ele (delete não lê o pai), e o tipo tem que ser o mesmo nos dois lados.
 *
 * `UNKNOWN` é o payload em que **não há nome de evento reconhecível** — só
 * `data[FIELDS][ENTITY_TYPE_ID]`. Ele nunca despacha efeito nenhum: inferir `ADD` ali
 * criaria instância que ninguém pediu, e inferir `DELETE` desassinaria recurso de
 * cliente ativo. O custo do contrário é uma linha manual esperando provisionamento —
 * visível, e recuperável.
 */
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

/** As SPAs cujos eventos têm efeito sobre o recurso no provider. */
function isProviderEffectSpa(entityTypeId: number): boolean {
  return (
    entityTypeId === env.payments.spa.subscriptionItemEntityType ||
    entityTypeId === env.payments.spa.subscriptionEntityType
  )
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
 * Enfileira um job por id de item da SPA de itens.
 *
 * Dependência de **função**, não do caso de uso: é o que mantém o módulo `payments` sem
 * dependência do `thinkzap`, onde provisionamento e limpeza vivem. O controller sabe que
 * existe uma fila; não sabe o que ela faz.
 */
export type EnqueueSpaItemProvisioning = (job: {
  itemId: string
  traceKey: string
  /**
   * Sempre `spa-webhook` daqui. Vai no job para o worker distinguir o efeito pedido pelo
   * evento da SPA — que só produção executa — do pedido pelo próprio app.
   */
  source: 'spa-webhook'
}) => Promise<unknown>

/** Enfileira a reconciliação de cobrança das linhas de uma assinatura da SPA 1142. */
export type EnqueueSubscriptionBillingSync = (job: {
  subscriptionId: string
  traceKey: string
  source: 'spa-webhook'
}) => Promise<unknown>

/**
 * Desvincula o item espelho de uma instalação, resolvendo-a pelo id do item da SPA 1060.
 *
 * Função, e não o repositório, pela mesma razão das filas: o controller não precisa
 * saber que existe Prisma do outro lado, e injetar o repositório traria com ele os
 * outros oito métodos que este caminho não usa.
 */
export type UnlinkAplicationSpaItem = (itemId: string) => Promise<void>

/**
 * Os efeitos que o controller despacha depois de invalidar.
 *
 * Objeto, e não quatro parâmetros posicionais: são todos funções de assinatura
 * parecida, e trocar duas de lugar numa fábrica compilaria — com o sintoma sendo um
 * item provisionado quando devia ser limpo.
 */
export type SpaWebhookEffects = {
  /** `ADD` na SPA 1146: provisiona o conector do item criado à mão. */
  enqueueProvisioning: EnqueueSpaItemProvisioning
  /** `DELETE` na SPA 1146: desassina e desconecta o recurso do item apagado. */
  enqueueCleanup: EnqueueSpaItemProvisioning
  /** `UPDATE` na SPA 1146: reconcilia o recurso com o status do item. */
  enqueueStatusSync: EnqueueSpaItemProvisioning
  /** `UPDATE` na SPA 1142: reconcilia a cobrança de cada linha da assinatura. */
  enqueueSubscriptionBillingSync: EnqueueSubscriptionBillingSync
  /** `DELETE` na SPA 1060: devolve `core_apps.spa_id` a `NULL`. */
  unlinkAplicationSpaItem: UnlinkAplicationSpaItem
}

/**
 * Recebe o webhook de saída das SPAs de billing e traduz o evento em invalidação de
 * cache — e, no item de assinatura, nos efeitos sobre o conector dele: provisionamento
 * na criação, sincronização de status na edição, limpeza na exclusão. Na SPA de
 * aplicação, a exclusão também desvincula o espelho da instalação.
 *
 * A rota é pública (sem JWT): quem chama é o Bitrix, não uma instalação. A
 * autenticação é o `application_token` do próprio payload — o webhook de saída não
 * assina o corpo, então não há HMAC a validar como no Stripe.
 *
 * Só duas respostas fogem de 200: token divergente (401) e segredo não configurado
 * (503). Todo o resto — evento de SPA que não é de billing, payload sem id, Redis
 * fora do ar, falha de enfileiramento — responde 200 com log, porque o Bitrix desativa
 * handler de evento que erra em sequência, e handler desativado é falha silenciosa que
 * só aparece semanas depois.
 */
export class SpaWebhookController extends Controller {
  constructor(
    private readonly invalidate: InvalidateSpaCache,
    private readonly expectedToken: string,
    private readonly effects: SpaWebhookEffects,
    /**
     * `false` em homologação: o portal é o mesmo de produção, e os dois ambientes recebem
     * os mesmos eventos. Desligado, nenhum efeito que toque o provider é enfileirado — a
     * invalidação continua, porque o cache é de cada ambiente.
     */
    private readonly providerEffectsEnabled: boolean = true,
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

    const result = await this.invalidate.execute({ entityTypeId, itemId, verb })

    /**
     * Os despachos vêm **depois** da invalidação, e a ordem não é estética: os jobs
     * releem o item do Bitrix. Enfileirar antes deixaria o worker correndo contra uma
     * entrada de cache velha da própria SPA que ele acabou de ler.
     */
    if (this.providerEffectsEnabled) {
      await this.dispatchItemEffect({ entityTypeId, verb, itemId, event })
      await this.dispatchSubscriptionEffect({
        entityTypeId,
        verb,
        itemId,
        event,
      })
    } else if (isProviderEffectSpa(entityTypeId)) {
      apiLogger.debug(
        { app: 'payments', verb, entityTypeId, itemId },
        'Efeitos de provider desligados neste ambiente — evento da SPA só invalida cache',
      )
    }
    await this.dispatchAplicationUnlink({ entityTypeId, verb, itemId, event })

    return this.ok(result)
  }

  /**
   * Traduz o verbo do evento da SPA 1146 no efeito que ele tem sobre o conector.
   *
   * Os três verbos têm efeitos **distintos**, e é por isso que são jobs distintos:
   *
   * - `ADD` provisiona: o item nasce declarando provider e sem recurso do outro lado.
   * - `UPDATE` sincroniza status: o payload não traz o valor anterior do campo, então
   *   quem compara é o job, contra a marca do espelho. Provisionar aqui está fora de
   *   questão — trocar o provider de item já provisionado é destruir um recurso e criar
   *   outro, com QR code novo para o cliente.
   * - `DELETE` limpa: a credencial morreu com o item, e o recurso continua cobrado de
   *   nós até alguém desassiná-lo.
   *
   * `UNKNOWN` não despacha nada. Inferir `ADD` criaria instância que ninguém pediu, e
   * inferir `DELETE` desassinaria recurso de cliente ativo.
   */
  private async dispatchItemEffect(args: {
    entityTypeId: number
    verb: EventVerb
    itemId: string | undefined
    event: string | undefined
  }): Promise<void> {
    if (args.entityTypeId !== env.payments.spa.subscriptionItemEntityType)
      return

    const effect =
      args.verb === 'ADD'
        ? {
            enqueue: this.effects.enqueueProvisioning,
            missingIdMessage:
              'Criação de item de assinatura sem id — nada a provisionar',
            failureMessage:
              'Não foi possível enfileirar o provisionamento do item — item criado à mão fica pendente',
          }
        : args.verb === 'UPDATE'
          ? {
              enqueue: this.effects.enqueueStatusSync,
              missingIdMessage:
                'Atualização de item de assinatura sem id — nada a sincronizar',
              failureMessage:
                'Não foi possível enfileirar a sincronização de status do item — o recurso fica com a cobrança divergente do status',
            }
          : args.verb === 'DELETE'
            ? {
                enqueue: this.effects.enqueueCleanup,
                missingIdMessage:
                  'Exclusão de item de assinatura sem id — nada a limpar',
                failureMessage:
                  'Não foi possível enfileirar a limpeza do item — o recurso fica órfão no provider',
              }
            : null

    if (!effect) return

    if (!args.itemId) {
      apiLogger.warn(
        { app: 'payments', event: args.event },
        effect.missingIdMessage,
      )
      return
    }

    try {
      await effect.enqueue({
        itemId: args.itemId,
        traceKey: `spa-item-${args.itemId}`,
        source: 'spa-webhook',
      })
    } catch (error) {
      /**
       * Falha de enfileiramento responde **200**, pela mesma razão que a falha de
       * invalidação responde: o Bitrix desativa handler que erra em sequência, e um
       * handler desativado é falha silenciosa que só aparece semanas depois. O efeito
       * fica pendente, e é este log que nomeia isso.
       */
      apiLogger.error(
        { app: 'payments', itemId: args.itemId, verb: args.verb, err: error },
        effect.failureMessage,
      )
    }
  }

  /**
   * Reconcilia a cobrança das linhas quando a assinatura (SPA 1142) é editada.
   *
   * Existe pela assinatura manual: ela costuma nascer com os itens antes de virar
   * "Ativo", e a mudança de status acontece na 1142 — sem evento nenhum na 1146. Sem
   * este gatilho a linha só seria assinada no provider no próximo toque no item.
   *
   * Só `UPDATE`: na criação a assinatura ainda não tem itens, e a exclusão de contrato
   * é administrada pelo gateway ou pela automação da modalidade manual.
   */
  private async dispatchSubscriptionEffect(args: {
    entityTypeId: number
    verb: EventVerb
    itemId: string | undefined
    event: string | undefined
  }): Promise<void> {
    if (args.verb !== 'UPDATE') return
    if (args.entityTypeId !== env.payments.spa.subscriptionEntityType) return

    if (!args.itemId) {
      apiLogger.warn(
        { app: 'payments', event: args.event },
        'Atualização de assinatura sem id — nada a reconciliar',
      )
      return
    }

    try {
      await this.effects.enqueueSubscriptionBillingSync({
        subscriptionId: args.itemId,
        traceKey: `spa-subscription-${args.itemId}`,
        source: 'spa-webhook',
      })
    } catch (error) {
      apiLogger.error(
        { app: 'payments', subscriptionId: args.itemId, err: error },
        'Não foi possível enfileirar a cobrança das linhas da assinatura — linhas podem ficar sem assinar no provider',
      )
    }
  }

  /**
   * Desvincula o espelho quando o item da SPA 1060 é apagado.
   *
   * Só no `DELETE`: editar o espelho não é apagá-lo. E só com id, porque sem ele não há
   * instalação a resolver — adivinhar desvincularia outra.
   *
   * Item que não corresponde a instalação nenhuma é o caso **comum**, não a exceção:
   * item da SPA 1060 criado e apagado à mão no CRM não espelha nada. Quem trata isso é
   * o outro lado da função; aqui não há o que distinguir.
   */
  private async dispatchAplicationUnlink(args: {
    entityTypeId: number
    verb: EventVerb
    itemId: string | undefined
    event: string | undefined
  }): Promise<void> {
    if (args.verb !== 'DELETE') return
    if (args.entityTypeId !== env.payments.spa.aplicationEntityType) return

    if (!args.itemId) {
      apiLogger.warn(
        { app: 'payments', event: args.event },
        'Exclusão na SPA de aplicação sem id — nada a desvincular',
      )
      return
    }

    try {
      await this.effects.unlinkAplicationSpaItem(args.itemId)
    } catch (error) {
      /**
       * `error` e 200: o vínculo pendurado permanece, e o caminho de correção é o
       * backfill do vínculo — que revincula por par (domínio, app code). Propagar aqui
       * só ensinaria o Bitrix a desativar o handler.
       */
      apiLogger.error(
        { app: 'payments', spaId: args.itemId, err: error },
        'Não foi possível desvincular o espelho da instalação — o vínculo fica pendurado até o backfill',
      )
    }
  }
}
