import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type {
  ThinkzapOutboxKind,
  ThinkzapOutboxOrigin,
  ThinkzapOutboxStatus,
} from '@/prisma/client'
import type { InteractiveButtonDescriptor } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import type { TemplateButtonParameter } from '@/modules/thinkzap/domain/ports/template-message-sender.port'

export type WidgetOutboxStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'UNKNOWN'

/**
 * O que o worker vai chamar no provider.
 *
 * Mensagem livre e template compartilham a intenção durável inteira — a marca de
 * entrega, o claim condicional, o lock por destino, os efeitos colaterais. O que muda
 * é uma chamada, e é só isso que este discriminador carrega.
 */
export type WidgetOutboxKind =
  | 'TEXT'
  | 'TEMPLATE'
  | 'INTERACTIVE_BUTTON'
  | 'MEDIA'

/** De onde veio o envio — ver o enum `ThinkzapOutboxOrigin` no schema. */
export type WidgetOutboxOrigin =
  | 'WIDGET'
  | 'WIDGET_ATTACHMENT'
  | 'ROBOT_MESSAGE'
  | 'ROBOT_BUTTONS'
  | 'ROBOT_TEMPLATE'
  | 'SMS_CAMPAIGN'
  | 'OPERATOR'
  | 'BOT'

export type OutboxMediaType = 'image' | 'video' | 'audio' | 'document'

/** JSON livre por origem; cada consumidor valida a forma que espera. */
export type OutboxJson = Record<string, unknown>

export type WidgetOutboxRecord = {
  id: string
  clientMessageId: string
  instanceId: string
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  text: string
  entity: string
  entityId: string
  kind: WidgetOutboxKind
  /** Preenchidos só em `kind: 'TEMPLATE'`. */
  templateName: string | null
  templateLanguage: string | null
  templateParameters: string[] | null
  /** Botões dinâmicos do template; `null` em row anterior a eles. */
  templateButtonParameters: TemplateButtonParameter[] | null
  /** Imagem do cabeçalho do template; `null` = envio sem cabeçalho. */
  templateHeaderImageUrl: string | null
  /** Preenchido só em `kind: 'INTERACTIVE_BUTTON'`. */
  buttonPayload: InteractiveButtonDescriptor | null
  status: WidgetOutboxStatus
  providerMessageId: string | null
  timelineNotifiedAt: Date | null
  attempts: number
  lastError: string | null
  /**
   * Operador do Bitrix24 que originou o envio. `null` nas rows gravadas antes da
   * coluna existir — essas entregam sem prefixo de nome.
   */
  operatorBitrixUserId: string | null
  /**
   * Âncoras da campanha de SMS do Bitrix. Preenchidas **só** no envio vindo do handler
   * da campanha; nulas em widget e robô, que não reportam status a lugar nenhum.
   */
  smsSenderCode: string | null
  smsMessageId: string | null
  origin: WidgetOutboxOrigin
  /** Preenchidos só em `kind: 'MEDIA'`. */
  mediaType: OutboxMediaType | null
  mediaSource: OutboxJson | null
  fileName: string | null
  caption: string | null
  dispatchGroupId: string | null
  partIndex: number | null
  dispatchMeta: OutboxJson | null
  bitrixMessageId: string | null
  bitrixChatId: string | null
  originContext: OutboxJson | null
  queueSeq: number | null
  cadenceWaitUntil: Date | null
  createdAt: Date
  sentAt: Date | null
}

export type CreateWidgetOutboxInput = {
  clientMessageId: string
  instanceId: string
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  /** O texto que o contato lê. Em template, o corpo **já resolvido**. */
  text: string
  entity: string
  entityId: string
  /** Ausente = `TEXT`, que é o que toda row anterior ao template é. */
  kind?: WidgetOutboxKind
  templateName?: string
  templateLanguage?: string
  templateParameters?: string[]
  /** Vazio ou ausente = template sem botão dinâmico; a coluna fica nula. */
  templateButtonParameters?: TemplateButtonParameter[]
  /** Ausente = template sem cabeçalho de imagem; a coluna fica nula. */
  templateHeaderImageUrl?: string | null
  /** Preenchido só em `kind: 'INTERACTIVE_BUTTON'`. */
  buttonPayload?: InteractiveButtonDescriptor
  /** Do token da requisição — é o que o worker usa para resolver o nome. */
  operatorBitrixUserId?: string | null
  /**
   * Âncoras da campanha, gravadas só pelo handler de `messageservice`. É o par que o
   * Bitrix precisa para casar o status com a mensagem na tela de campanha, e a marca
   * que diz ao worker que aquele envio veio de uma.
   */
  smsSenderCode?: string | null
  smsMessageId?: string | null
  /** Ausente = `WIDGET`, o default do banco. */
  origin?: WidgetOutboxOrigin
  mediaType?: OutboxMediaType
  mediaSource?: OutboxJson
  fileName?: string | null
  caption?: string | null
  dispatchGroupId?: string | null
  partIndex?: number | null
  dispatchMeta?: OutboxJson
  bitrixMessageId?: string | null
  bitrixChatId?: string | null
  originContext?: OutboxJson
}

/** Uma parte de um envio em grupo, com o desfecho que importa para a timeline. */
export type OutboxGroupPart = Pick<
  WidgetOutboxRecord,
  | 'id'
  | 'partIndex'
  | 'destination'
  | 'kind'
  | 'mediaType'
  | 'fileName'
  | 'status'
  | 'lastError'
  | 'dispatchMeta'
  | 'text'
  | 'providerMessageId'
  | 'mediaSource'
>

/**
 * O `template_parameters` volta do MySQL como JSON livre, e o tipo do Prisma para
 * coluna `Json` não promete array de string.
 *
 * Row com JSON de outra forma — escrita à mão, ou de uma versão futura que mude o
 * formato — vira `null` em vez de derrubar a leitura: quem consome trata a ausência
 * como template sem variável, e o guard do despacho recusa o que faltar de fato.
 */
function toBodyParameters(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.every(item => typeof item === 'string') ? value : null
}

/**
 * O `template_button_parameters` volta como JSON livre, mirror de
 * `toBodyParameters`: formato inesperado vira `null`, e o envio sai sem botão em
 * vez de a leitura derrubar o despacho — a Meta recusa se o botão era obrigatório.
 */
function toButtonParameters(value: unknown): TemplateButtonParameter[] | null {
  if (!Array.isArray(value)) return null
  const valid = value.every(item => {
    const candidate = (item ?? {}) as Record<string, unknown>
    return (
      Number.isInteger(candidate.index) &&
      (candidate.subType === 'URL' || candidate.subType === 'COPY_CODE') &&
      typeof candidate.value === 'string'
    )
  })
  return valid ? (value as TemplateButtonParameter[]) : null
}

/**
 * O `button_payload` volta do MySQL como JSON livre, mirror de
 * `toBodyParameters`. Row com formato inesperado vira `null` em vez de
 * derrubar a leitura — quem consome trata a ausência como falta de payload, e
 * o worker recusa o despacho por falta do que precisa, não por exceção.
 */
function toButtonPayload(value: unknown): InteractiveButtonDescriptor | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.body !== 'string') return null
  if (!Array.isArray(candidate.buttons)) return null
  return candidate as unknown as InteractiveButtonDescriptor
}

function toJson(value: unknown): OutboxJson | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as OutboxJson
}

const MEDIA_TYPES: readonly string[] = ['image', 'video', 'audio', 'document']

function toMediaType(value: string | null): OutboxMediaType | null {
  return value && MEDIA_TYPES.includes(value)
    ? (value as OutboxMediaType)
    : null
}

type OutboxRow = {
  id: string
  clientMessageId: string
  instanceId: string
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  text: string
  entity: string
  entityId: string
  kind: ThinkzapOutboxKind
  templateName: string | null
  templateLanguage: string | null
  templateParameters: unknown
  templateButtonParameters: unknown
  templateHeaderImageUrl: string | null
  buttonPayload: unknown
  status: ThinkzapOutboxStatus
  providerMessageId: string | null
  timelineNotifiedAt: Date | null
  attempts: number
  lastError: string | null
  operatorBitrixUserId: string | null
  smsSenderCode: string | null
  smsMessageId: string | null
  origin: ThinkzapOutboxOrigin
  mediaType: string | null
  mediaSource: unknown
  fileName: string | null
  caption: string | null
  dispatchGroupId: string | null
  partIndex: number | null
  dispatchMeta: unknown
  bitrixMessageId: string | null
  bitrixChatId: string | null
  originContext: unknown
  queueSeq: number | null
  cadenceWaitUntil: Date | null
  createdAt: Date
  sentAt: Date | null
}

function mapRow(row: OutboxRow): WidgetOutboxRecord {
  return {
    id: row.id,
    clientMessageId: row.clientMessageId,
    instanceId: row.instanceId,
    subscriptionItemId: row.subscriptionItemId,
    domainId: row.domainId,
    appCode: row.appCode,
    destination: row.destination,
    text: row.text,
    entity: row.entity,
    entityId: row.entityId,
    kind: row.kind as WidgetOutboxKind,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    templateParameters: toBodyParameters(row.templateParameters),
    templateButtonParameters: toButtonParameters(row.templateButtonParameters),
    templateHeaderImageUrl: row.templateHeaderImageUrl,
    buttonPayload: toButtonPayload(row.buttonPayload),
    status: row.status as WidgetOutboxStatus,
    providerMessageId: row.providerMessageId,
    timelineNotifiedAt: row.timelineNotifiedAt,
    attempts: row.attempts,
    lastError: row.lastError,
    operatorBitrixUserId: row.operatorBitrixUserId,
    smsSenderCode: row.smsSenderCode,
    smsMessageId: row.smsMessageId,
    origin: row.origin as WidgetOutboxOrigin,
    mediaType: toMediaType(row.mediaType),
    mediaSource: toJson(row.mediaSource),
    fileName: row.fileName,
    caption: row.caption,
    dispatchGroupId: row.dispatchGroupId,
    partIndex: row.partIndex,
    dispatchMeta: toJson(row.dispatchMeta),
    bitrixMessageId: row.bitrixMessageId,
    bitrixChatId: row.bitrixChatId,
    originContext: toJson(row.originContext),
    queueSeq: row.queueSeq,
    cadenceWaitUntil: row.cadenceWaitUntil,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  }
}

/**
 * Os campos `Json` ficam **fora** do spread quando são `undefined`: numa coluna
 * `Json` do Prisma, `undefined` significa "não escreva" e `null` exigiria
 * `Prisma.DbNull`. Omitir a chave é o único jeito de a row de outro `kind` nascer
 * com a coluna nula sem importar o sentinela aqui. Lista de botões vazia também
 * fica nula: é o mesmo que "sem botão dinâmico".
 */
function toCreateData(input: CreateWidgetOutboxInput) {
  const {
    templateParameters,
    templateButtonParameters,
    buttonPayload,
    mediaSource,
    dispatchMeta,
    originContext,
    ...rest
  } = input

  return {
    id: randomUUID(),
    ...rest,
    ...(templateParameters ? { templateParameters } : {}),
    ...(templateButtonParameters?.length ? { templateButtonParameters } : {}),
    ...(buttonPayload ? { buttonPayload } : {}),
    ...(mediaSource ? { mediaSource: mediaSource as object } : {}),
    ...(dispatchMeta ? { dispatchMeta: dispatchMeta as object } : {}),
    ...(originContext ? { originContext: originContext as object } : {}),
  }
}

/**
 * A fila durável do envio pelo widget.
 *
 * O método que carrega o desenho inteiro é `claimForSending`: ele é um **update
 * condicional**, não um read-then-write. Dois workers processando o mesmo job — o que
 * o BullMQ evita, mas nada garante sob falha de rede e job stalled — só podem ter um
 * vencedor, e é o banco que decide. Ler o status e depois gravá-lo deixaria a janela
 * entre as duas operações aberta, que é exatamente onde a mensagem sairia duas vezes.
 */
export class PrismaWidgetOutboxRepository {
  async create(input: CreateWidgetOutboxInput): Promise<WidgetOutboxRecord> {
    const row = await prisma.thinkzapWidgetOutbox.create({
      data: toCreateData(input),
    })

    return mapRow(row)
  }

  /**
   * Grava as partes de um envio de uma vez, **idempotente**: parte cujo
   * `(instanceId, clientMessageId)` já existe fica como está — reprocessar o mesmo
   * evento do Bitrix não duplica mensagem. Devolve todas as partes pedidas, novas e
   * antigas, na ordem da entrada.
   */
  async createParts(
    inputs: CreateWidgetOutboxInput[],
  ): Promise<WidgetOutboxRecord[]> {
    if (inputs.length === 0) return []

    await prisma.thinkzapWidgetOutbox.createMany({
      data: inputs.map(toCreateData),
      skipDuplicates: true,
    })

    const rows = await prisma.thinkzapWidgetOutbox.findMany({
      where: {
        instanceId: inputs[0]!.instanceId,
        clientMessageId: { in: inputs.map(i => i.clientMessageId) },
      },
    })
    const byClientId = new Map(rows.map(row => [row.clientMessageId, row]))

    return inputs
      .map(i => byClientId.get(i.clientMessageId))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map(mapRow)
  }

  /** Posição na fila FIFO da linha. Só grava a primeira: a posição não muda. */
  async setQueueSeq(id: string, queueSeq: number): Promise<void> {
    await prisma.thinkzapWidgetOutbox.updateMany({
      where: { id, queueSeq: null },
      data: { queueSeq },
    })
  }

  /** Quando a mensagem adiada pela cadência deve sair — o que o widget mostra. */
  async markWaiting(id: string, waitUntil: Date): Promise<void> {
    await prisma.thinkzapWidgetOutbox.updateMany({
      where: { id, status: 'PENDING' },
      data: { cadenceWaitUntil: waitUntil },
    })
  }

  /** As partes de um grupo, na ordem de `partIndex`. */
  async groupOutcome(dispatchGroupId: string): Promise<OutboxGroupPart[]> {
    const rows = await prisma.thinkzapWidgetOutbox.findMany({
      where: { dispatchGroupId },
      orderBy: { partIndex: 'asc' },
    })
    return rows.map(mapRow).map(r => ({
      id: r.id,
      partIndex: r.partIndex,
      destination: r.destination,
      kind: r.kind,
      mediaType: r.mediaType,
      fileName: r.fileName,
      status: r.status,
      lastError: r.lastError,
      dispatchMeta: r.dispatchMeta,
      text: r.text,
      providerMessageId: r.providerMessageId,
      mediaSource: r.mediaSource,
    }))
  }

  /**
   * Carimbo de idempotência do comentário **agregado** do grupo, na row de
   * `partIndex = 0`. Update condicional: das partes que terminam juntas, só uma
   * vence e publica.
   */
  async claimGroupTimelineNotification(
    dispatchGroupId: string,
  ): Promise<boolean> {
    const { count } = await prisma.thinkzapWidgetOutbox.updateMany({
      where: { dispatchGroupId, partIndex: 0, timelineNotifiedAt: null },
      data: { timelineNotifiedAt: new Date() },
    })
    return count > 0
  }

  /** As rows de uma instalação por `clientMessageId` — o status no widget. */
  async findByClientMessageIds(
    domainId: string,
    clientMessageIds: string[],
  ): Promise<WidgetOutboxRecord[]> {
    if (clientMessageIds.length === 0) return []
    const rows = await prisma.thinkzapWidgetOutbox.findMany({
      where: { domainId, clientMessageId: { in: clientMessageIds } },
    })
    return rows.map(mapRow)
  }

  async findById(id: string): Promise<WidgetOutboxRecord | null> {
    const row = await prisma.thinkzapWidgetOutbox.findUnique({ where: { id } })
    return row ? mapRow(row) : null
  }

  /**
   * A row entregue sob um id de mensagem do provider, ou `null`.
   *
   * Escopada por instância porque `providerMessageId` é único **no provider**, não no
   * sistema: dois portais podem receber o mesmo id de canais diferentes, e é a
   * instância que separa os dois.
   */
  async findByProviderMessageId(
    instanceId: string,
    providerMessageId: string,
  ): Promise<WidgetOutboxRecord | null> {
    const row = await prisma.thinkzapWidgetOutbox.findFirst({
      where: { instanceId, providerMessageId },
    })

    return row ? mapRow(row) : null
  }

  /**
   * A row já gravada para um `message_id` do Bitrix, ou `null`.
   *
   * A idempotência da campanha é o unique da coluna; esta leitura é o caminho feliz
   * dela: retentativa do Bitrix reencontra a row e responde `200` reafirmando o
   * estado, em vez de bater na constraint. A constraint segue sendo a garantia — duas
   * requisições concorrentes passam pelas duas leituras antes de qualquer gravação.
   */
  async findBySmsMessageId(
    smsMessageId: string,
  ): Promise<WidgetOutboxRecord | null> {
    const row = await prisma.thinkzapWidgetOutbox.findUnique({
      where: { smsMessageId },
    })

    return row ? mapRow(row) : null
  }

  /**
   * Reivindica a intenção para envio. Devolve `true` só para quem venceu.
   *
   * `updateMany` com `where: { status: 'PENDING' }` é o ponto inteiro: o MySQL aplica
   * a condição na hora do update, então a corrida resolve no banco. `count === 0`
   * significa que outro worker chegou primeiro — ou que a row já saiu de `PENDING` por
   * outro motivo — e o chamador **não** pode enviar.
   */
  async claimForSending(id: string): Promise<boolean> {
    const { count } = await prisma.thinkzapWidgetOutbox.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    })

    return count > 0
  }

  /** A marca de entrega. Depois disto, nenhuma retentativa chama o provider. */
  async markSent(id: string, providerMessageId: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { status: 'SENT', providerMessageId, sentAt: new Date() },
    })
  }

  async markFailed(id: string, error: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { status: 'FAILED', lastError: error.slice(0, 2000) },
    })
  }

  /**
   * Morte durante a chamada HTTP ao provider. Estado terminal **por decisão**: não há
   * como saber localmente se a mensagem saiu, e reenviar trocaria uma incerteza rara
   * por duplicidade garantida no WhatsApp de quem recebe.
   */
  async markUnknown(id: string, error: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { status: 'UNKNOWN', lastError: error.slice(0, 2000) },
    })
  }

  /**
   * Devolve a intenção para `PENDING` sem consumir a marca de entrega.
   *
   * Para a falha **antes** da chamada ao provider: a retentativa do BullMQ precisa
   * reencontrar a row reivindicável, senão o claim falharia para sempre e o job
   * morreria em `SENDING` sem nunca ter enviado nada.
   */
  async releaseToPending(id: string, error: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.updateMany({
      where: { id, status: 'SENDING', providerMessageId: null },
      data: { status: 'PENDING', lastError: error.slice(0, 2000) },
    })
  }

  /** Carimbo de idempotência do comentário de timeline. */
  async markTimelineNotified(id: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { timelineNotifiedAt: new Date() },
    })
  }

  /**
   * Limpeza por retenção. Só `SENT`: `FAILED` e `UNKNOWN` ficam até alguém resolver,
   * porque são exatamente as rows que descrevem mensagem que o cliente não recebeu.
   */
  async deleteSentOlderThan(cutoff: Date): Promise<number> {
    const { count } = await prisma.thinkzapWidgetOutbox.deleteMany({
      where: { status: 'SENT', createdAt: { lt: cutoff } },
    })

    return count
  }

  /** As rows dos ids informados, sem ordem garantida. */
  async findByIds(ids: string[]): Promise<WidgetOutboxRecord[]> {
    if (ids.length === 0) return []
    const rows = await prisma.thinkzapWidgetOutbox.findMany({
      where: { id: { in: ids } },
    })
    return rows.map(mapRow)
  }

  /** Dos ids informados, os que ainda esperam envio — a varredura do sequenciador. */
  async findLiveIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set()
    const rows = await prisma.thinkzapWidgetOutbox.findMany({
      where: { id: { in: ids }, status: { in: ['PENDING', 'SENDING'] } },
      select: { id: true },
    })
    return new Set(rows.map(row => row.id))
  }

  /** Alimenta o alerta de pendência antiga (ver task de observabilidade). */
  async countPendingOlderThan(cutoff: Date): Promise<number> {
    return prisma.thinkzapWidgetOutbox.count({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
    })
  }
}
