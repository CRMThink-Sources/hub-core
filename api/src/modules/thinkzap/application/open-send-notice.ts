import { randomUUID } from 'node:crypto'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { PrismaSendNoticeRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import type { SendNoticeJob } from '@/queue/thinkzap-send-notices.queue'
import { apiLogger } from '@/shared/infra/logger'
import { withTimeout } from './helpers/with-timeout'

/**
 * Prazo de cada passo. Curto porque quem espera é a resposta do webhook do robô, e
 * o aviso é acessório: com o banco preso num lock ou o Redis fora (o `add` do
 * BullMQ não rejeita, fica esperando a conexão), o disparo segue sem ele.
 */
export const OPEN_SEND_NOTICE_TIMEOUT_MS = 2_000

export type OpenSendNoticeInput = {
  entity: string
  entityId: string
  domainId: string
  appCode: string
  operatorBitrixUserId: string | null
}

export type OpenedSendNotice = {
  id: string
  /** Agenda a publicação do comentário. Nunca lança. */
  refresh: () => Promise<void>
}

/**
 * Abre o aviso de um disparo com vários destinatários **antes** de enfileirar, para
 * as rows nascerem ligadas a ele.
 */
export type OpenSendNotice = (
  input: OpenSendNoticeInput,
) => Promise<OpenedSendNotice | null>

export type OpenSendNoticeDeps = {
  notices: Pick<PrismaSendNoticeRepository, 'ensure'>
  enqueue: (job: SendNoticeJob) => Promise<void>
}

function logFailure(err: unknown, msg: string): void {
  logThinkzapError(
    apiLogger,
    'thinkzap.message.widget_send_notice_failed',
    { app: 'thinkzap', err },
    { level: 'warn', msg },
  )
}

/**
 * `null` fora do CRM ou em qualquer falha: o envio segue, e o worker cria um aviso
 * por row quando ela mudar de estado. Um aviso que sobre sem nenhuma row não
 * publica nada.
 */
export async function openSendNotice(
  input: OpenSendNoticeInput,
  deps: OpenSendNoticeDeps,
): Promise<OpenedSendNotice | null> {
  if (!input.entity || !input.entityId) return null

  try {
    const { id } = await withTimeout(
      deps.notices.ensure({
        ...input,
        dispatchKey: randomUUID(),
        // O comentário substitui o "enfileirado" do robô: sai sem esperar a fila.
        eager: true,
      }),
      OPEN_SEND_NOTICE_TIMEOUT_MS,
      'O aviso de envio não foi aberto a tempo.',
    )

    return {
      id,
      refresh: async () => {
        try {
          await withTimeout(
            deps.enqueue({ kind: 'comment', noticeId: id }),
            OPEN_SEND_NOTICE_TIMEOUT_MS,
            'O comentário de envio não foi agendado a tempo.',
          )
        } catch (error) {
          logFailure(error, 'Não foi possível agendar o comentário de envio')
        }
      },
    }
  } catch (error) {
    logFailure(error, 'Não foi possível abrir o aviso de envio')
    return null
  }
}
