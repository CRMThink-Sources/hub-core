import { timingSafeEqual } from 'node:crypto'
import { Request } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { apiLogger } from '@/shared/infra/logger'
import type { SyncCrmthinkTask } from '../../application/sync-crmthink-task'

/**
 * Payload do webhook de saída de tarefas do portal da CRMThink.
 *
 * Tudo opcional, como no webhook da SPA: payload incompleto vira `200` com log, não
 * `400` — o Bitrix desativa handler que erra em sequência, e um handler desativado é
 * falha silenciosa. Os campos chegam como formulário (`data[FIELDS_AFTER][ID]`), e é o
 * `express.urlencoded({ extended: true })` que os transforma nesta árvore.
 */
const idSchema = z.union([z.string(), z.number()]).optional()
const payloadSchema = z.object({
  event: z.string().optional(),
  data: z
    .object({
      FIELDS_AFTER: z.object({ ID: idSchema }).passthrough().optional(),
      FIELDS_BEFORE: z.object({ ID: idSchema }).passthrough().optional(),
    })
    .optional(),
  auth: z
    .object({
      application_token: z.string().optional(),
      domain: z.string().optional(),
    })
    .optional(),
})

type Payload = z.infer<typeof payloadSchema>

/** Os dois eventos assinados. O resto é ignorado com `200`. */
const EVENTS = ['ONTASKUPDATE', 'ONTASKDELETE'] as const
type TaskEvent = (typeof EVENTS)[number]

function parseEvent(event: string | undefined): TaskEvent | null {
  const normalized = event?.trim().toUpperCase()
  return EVENTS.find(e => e === normalized) ?? null
}

/**
 * Id da tarefa: `FIELDS_AFTER.ID`, ou `FIELDS_BEFORE.ID` — no `ONTASKDELETE` é o único
 * que vem preenchido.
 */
function parseTaskId(data: Payload['data']): number | null {
  const raw = data?.FIELDS_AFTER?.ID ?? data?.FIELDS_BEFORE?.ID
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Comparação de tempo constante — mesma do webhook da SPA. */
function tokenMatches(received: string, expected: string): boolean {
  const a = Buffer.from(received)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Enfileira a releitura de uma tarefa vinculada. Função, e não a fila, para o
 * controller não depender do BullMQ — e para o teste não precisar de Redis.
 */
export type EnqueueCrmthinkTaskSync = (job: {
  taskId: number
  traceKey: string
}) => Promise<unknown>

/**
 * `POST /api/webhooks/crmthink-tasks` — `ONTASKUPDATE` e `ONTASKDELETE` do portal da
 * CRMThink (D5).
 *
 * O portal **inteiro** dispara `ONTASKUPDATE`, então o caminho comum é a tarefa que
 * nenhuma novidade usa: uma consulta pelo índice único de `bitrixTaskId` e `200`, sem
 * nenhuma chamada ao Bitrix. Para tarefa vinculada:
 * - `ONTASKDELETE` desvincula direto, sem fila — não há o que ler no Bitrix;
 * - `ONTASKUPDATE` enfileira a releitura (`crmthink-task-sync`, `jobId` por tarefa e
 *   atraso de alguns segundos): o Bitrix espera resposta rápida, e a rajada de updates
 *   da mesma tarefa vira um job.
 *
 * A rota é pública: a autenticação é o `application_token` do payload. Só duas
 * respostas fogem de `200` — segredo não configurado (`503`) e token divergente
 * (`401`). Sincronização desligada, payload malformado e falha nossa respondem `200`
 * com log, pela mesma razão do webhook da SPA; a reconciliação horária cobre o que
 * se perder.
 */
export class CrmthinkTasksWebhookController extends Controller {
  constructor(
    private readonly sync: Pick<
      SyncCrmthinkTask,
      'findLinked' | 'unlinkDeleted'
    >,
    private readonly enqueueSync: EnqueueCrmthinkTaskSync,
    private readonly expectedToken: string,
    /** `CRMTHINK_TASKS_SYNC_ENABLED`. Desligada: responde `200` sem processar (D8). */
    private readonly syncEnabled: boolean,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    if (!this.expectedToken) {
      apiLogger.warn(
        { app: 'product-updates' },
        'CRMTHINK_TASKS_WEBHOOK_TOKEN não configurado — webhook de tarefas desabilitado',
      )
      return {
        status: 503,
        result: { error: 'CRMThink tasks webhook not configured' },
      }
    }

    // Corpo fora do schema vira objeto vazio: cai no token que não confere (401).
    const parsed = payloadSchema.safeParse(req.body)
    const payload: Payload = parsed.success ? parsed.data : {}

    if (
      !tokenMatches(payload.auth?.application_token ?? '', this.expectedToken)
    ) {
      apiLogger.warn(
        { app: 'product-updates', domain: payload.auth?.domain },
        'Webhook de tarefas com application token inválido',
      )
      return this.unauthorized(new Error('Invalid application token'))
    }

    if (!this.syncEnabled) {
      apiLogger.debug(
        { app: 'product-updates', event: payload.event },
        'Sincronização de tarefas desligada — evento ignorado',
      )
      return this.ok({ handled: false, reason: 'sync-disabled' })
    }

    const event = parseEvent(payload.event)
    const taskId = parseTaskId(payload.data)
    if (!event || taskId === null) {
      apiLogger.warn(
        { app: 'product-updates', event: payload.event },
        'Webhook de tarefas sem evento ou id de tarefa reconhecível — ignorando',
      )
      return this.ok({ handled: false, reason: 'malformed' })
    }

    try {
      return await this.dispatch(event, taskId)
    } catch (error) {
      /**
       * `200` mesmo com falha nossa (banco, Redis): propagar só ensinaria o Bitrix a
       * desativar o handler. A reconciliação horária relê a tarefa.
       */
      apiLogger.error(
        { app: 'product-updates', event, taskId, err: error },
        'Falha ao processar evento de tarefa — fica para a reconciliação',
      )
      return this.ok({ handled: false, reason: 'error' })
    }
  }

  private async dispatch(
    event: TaskEvent,
    taskId: number,
  ): Promise<httpResponse> {
    const linked = await this.sync.findLinked(taskId)
    if (!linked) return this.ok({ handled: false, reason: 'not-linked' })

    if (event === 'ONTASKDELETE') {
      const outcome = await this.sync.unlinkDeleted(taskId)
      return this.ok({ handled: true, outcome })
    }

    await this.enqueueSync({ taskId, traceKey: `crmthink-task-${taskId}` })
    return this.ok({ handled: true, outcome: 'enqueued' })
  }
}
