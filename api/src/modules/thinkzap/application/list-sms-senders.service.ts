import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { BitrixMethodCaller } from '@/shared/infra/clients/call-bitrix-idempotent'
import { apiLogger } from '@/shared/infra/logger'
import {
  parseSmsSenderCode,
  smsSenderCodePrefix,
} from './helpers/sms-sender-code'
import { rethrowAsScopeError } from './helpers/sms-sender-scope-error'

export type RegisteredSmsSender = {
  code: string
  name: string | null
  /** Id do item quando o `CODE` deriva de um; `null` no sender órfão. */
  subscriptionItemId: string | null
  /** Nome da linha correspondente, quando ela ainda existe. */
  lineName: string | null
  /**
   * `CODE` do ThinkZap que não casa com nenhuma linha da instalação.
   *
   * Órfão continua aparecendo na tela de campanha do cliente e faz **toda** campanha
   * disparada por ele falhar, destinatário por destinatário, sem explicação. A
   * listagem existe para o admin achar e remover esses.
   */
  orphan: boolean
  /** Nome do template, só no sender de template. `null` no sender de linha. */
  templateName: string | null
  language: string | null
}

/**
 * Uma entrada de `messageservice.sender.list`, no que dela nos importa.
 *
 * O Bitrix devolve as chaves em maiúsculas nos métodos de escrita e já foi visto
 * devolvendo minúsculas na leitura; os dois são lidos porque a diferença é invisível
 * até o dia em que a listagem volta vazia em produção.
 */
function readSender(
  entry: unknown,
): { code: string; name: string | null } | null {
  /**
   * Entrada como **string crua** é o `CODE` sozinho.
   *
   * É a forma que o método irmão `bizproc.robot.list` usa — ver
   * `parseBizprocRobotListResponse` —, e descartá-la era o que fazia esta listagem
   * voltar vazia com os senders existindo no portal. Sem nome: quem tem a linha
   * resolve o nome pelo `CODE`, e órfão não tem nome para mostrar mesmo.
   */
  if (typeof entry === 'string') {
    return entry ? { code: entry, name: null } : null
  }

  if (typeof entry !== 'object' || entry === null) return null

  const record = entry as Record<string, unknown>

  /**
   * `ID` entra como candidato a `CODE` porque `messageservice.sender.list` identifica
   * o sender pelo campo que o `add` chamou de `CODE` — e nem sempre com o mesmo nome.
   *
   * Aceitar candidato a mais é seguro **aqui**: quem decide o que é nosso é o parser
   * de `CODE` logo adiante, então um `ID` numérico interno simplesmente não é
   * reconhecido e sai. O oposto — não aceitar — é o que faz a listagem voltar vazia
   * com os senders existindo no portal.
   */
  const code = record.CODE ?? record.code ?? record.ID ?? record.id

  if (typeof code !== 'string' || !code) return null

  const name = record.NAME ?? record.name

  return { code, name: typeof name === 'string' ? name : null }
}

/**
 * Achata a resposta em uma lista de entradas, aceitando as formas que o Bitrix usa
 * para o mesmo dado.
 *
 * Além do array direto e do `{ result: [...] }`, cobre o objeto **agrupado por tipo**
 * (`{ SMS: [...] }`) e o objeto **indexado** (`{ '0': {...} }`) — o Bitrix serializa
 * lista das três formas dependendo do método, e nenhuma delas é anunciada no payload.
 */
function toEntryList(result: unknown): unknown[] {
  if (Array.isArray(result)) return result

  if (typeof result !== 'object' || result === null) return []

  const record = result as Record<string, unknown>

  if (Array.isArray(record.result)) return record.result
  if (typeof record.result === 'object' && record.result !== null) {
    return toEntryList(record.result)
  }

  /** `{ SMS: [...] }` e `{ '0': {...} }` caem os dois aqui. */
  return Object.values(record).flatMap((value): unknown[] =>
    Array.isArray(value) ? (value as unknown[]) : [value],
  )
}

function parseSenderListResponse(
  result: unknown,
): { code: string; name: string | null }[] {
  return toEntryList(result)
    .map(readSender)
    .filter((sender): sender is { code: string; name: string | null } =>
      Boolean(sender),
    )
}

/**
 * Descreve o **formato** da resposta, não o conteúdo.
 *
 * Só o suficiente para reconhecer qual serialização o Bitrix usou — tipo, tamanho e as
 * chaves da primeira entrada. Nome de linha e telefone do cliente não vão para o log.
 */
function describeShape(result: unknown): string {
  if (Array.isArray(result)) {
    const first: unknown = result[0]
    const keys =
      typeof first === 'object' && first !== null
        ? Object.keys(first).join(',')
        : typeof first

    return `array(${result.length}) de { ${keys} }`
  }

  if (typeof result === 'object' && result !== null) {
    return `object { ${Object.keys(result).join(',')} }`
  }

  return typeof result
}

/**
 * Os provedores de mensagem **do ThinkZap** registrados no portal do cliente.
 *
 * Sender registrado por outro aplicativo fica de fora: o prefixo é o que separa o que
 * é nosso, e listar o alheio convidaria o admin a remover o provedor de outro
 * fornecedor a partir da nossa tela.
 */
export async function listSmsSenders(
  client: BitrixMethodCaller,
  lines: Pick<SubscriptionItem, 'id' | 'name'>[],
): Promise<RegisteredSmsSender[]> {
  let result: unknown

  try {
    result = await client.callMethod('messageservice.sender.list', {})
  } catch (error) {
    rethrowAsScopeError('messageservice.sender.list', error)
  }

  const prefix = smsSenderCodePrefix()
  const lineById = new Map(lines.map(line => [line.id, line]))
  const parsed = parseSenderListResponse(result)

  /**
   * O que é nosso é o que o parser de `CODE` reconhece, e **não** um `startsWith` do
   * prefixo: sender de linha usa `_` depois do prefixo e sender de template usa `.`,
   * então um prefixo com separador fixo deixaria uma das duas famílias de fora — foi
   * o que aconteceu com os senders de template, invisíveis em toda tela.
   */
  const ours = parsed.flatMap(sender => {
    const code = parseSmsSenderCode(sender.code)

    return code ? [{ ...sender, parsedCode: code }] : []
  })

  /**
   * O Bitrix respondeu algo e nada foi reconhecido como sender.
   *
   * É o sintoma exato de formato de resposta que este parser ainda não cobre — e ele é
   * **silencioso** por natureza: a tela mostra "sem provedor registrado" para linhas
   * que têm provedor, e convida o admin a registrar de novo. O log traz as chaves da
   * primeira entrada (não o payload inteiro) para nomear o formato sem despejar dado do
   * cliente no log.
   */
  if (ours.length === 0) {
    apiLogger.warn(
      {
        app: 'thinkzap',
        prefix,
        parsedCount: parsed.length,
        parsedCodes: parsed.slice(0, 5).map(sender => sender.code),
        rawShape: describeShape(result),
      },
      'messageservice.sender.list não devolveu nenhum sender do ThinkZap',
    )
  }

  return ours
    .map(sender => {
      const { parsedCode } = sender
      const line = lineById.get(parsedCode.subscriptionItemId) ?? null

      return {
        code: sender.code,
        name: sender.name,
        subscriptionItemId: parsedCode.subscriptionItemId,
        lineName: line?.name ?? null,
        orphan: !line,
        /** Presentes só no sender de template — a tela distingue os dois por eles. */
        templateName:
          parsedCode.kind === 'template' ? parsedCode.templateName : null,
        language: parsedCode.kind === 'template' ? parsedCode.language : null,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code))
}
