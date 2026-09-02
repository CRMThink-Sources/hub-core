/**
 * Traduz a recusa da Meta, que a HubMessage repassa no item de estado do callback,
 * para uma frase que diz ao operador **o que fazer**.
 *
 * O motivo chega por duas portas, e nenhuma delas é confiável sozinha:
 *
 * - `external_information.errors[]`, com o código da Cloud API (`131047`) e o texto
 *   da Meta em `title` / `message` / `error_data.details`;
 * - `state.failedDescription`, que traz o corpo HTTP cru da Cloud API dentro de uma
 *   string ("Integration with meta-whatsapp failed (HTTP 400): {\"messaging_product\":...}").
 *
 * Ler só o `failedDescription` foi o defeito que esta tradução tinha: no callback de
 * janela de 24h fechada (2026-08-30) ele veio `null`, o motivo estava no `errors[]`, e
 * o operador recebeu "recusou o envio e não informou o motivo. Verifique a conexão da
 * linha" — conselho que manda mexer justamente no que não tem problema.
 *
 * Resolução em três etapas, nesta ordem: código de erro conhecido (igualdade exata),
 * substring sobre o texto de todas as fontes, texto genérico. O cru **nunca** é
 * descartado: vai sempre para o log estruturado, e no genérico também para o chat,
 * truncado.
 *
 * Padrão de texto casado por substring em minúsculas, não por parse do JSON embutido:
 * o formato do corpo é da Meta, muda sem aviso, e um parse quebrado transformaria
 * "erro traduzido" em "erro ao traduzir o erro".
 */

import type {
  HubMessageDeliveryError,
  HubMessageStateItem,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'

/** Teto do trecho cru que vai ao chat. Linha longa vira parede de texto no canal. */
const RAW_DESCRIPTION_MAX_CHARS = 300

const PREFIX = '⚠️ Sua mensagem não foi entregue: '

/**
 * A frase da janela fechada, compartilhada pelo casamento por código (`131047`) e pelo
 * casamento por texto. Uma constante só porque são o mesmo erro por duas portas, e
 * duas cópias divergiriam na primeira vez que alguém melhorasse o texto.
 *
 * Diz o que fazer, no imperativo, e não só qual é a regra: "só um template reabre a
 * conversa" deixa o operador deduzir a ação, e foi essa dedução que não aconteceu.
 */
const REENGAGEMENT_NOTICE =
  'a janela de 24 horas desta conversa está fechada — o contato respondeu por último ' +
  'há mais de 24 horas, e o WhatsApp Oficial só aceita mensagem livre dentro dessa ' +
  'janela. Envie um novo template aprovado pelo widget do CRMThink para reabrir a ' +
  'conversa; depois que o contato responder, a mensagem livre volta a sair.'

/**
 * Códigos de erro da Cloud API da Meta que têm ação distinta para o operador.
 *
 * Igualdade **exata**, nunca faixa nem prefixo. `132000`–`132016` são todos de
 * template e a tentação é casar `132`, mas um código `132xxx` novo com outro
 * significado receberia a frase de template e mandaria mexer no lugar errado — o
 * mesmo defeito que esta tradução corrige, só com outra pele.
 *
 * Só o `131047` veio de payload observado em produção. Os demais vêm da lista
 * documentada da Cloud API e entram com o peso de uma suposição documentada: é por
 * isso que o casamento por texto continua rodando depois, e não foi substituído por
 * esta tabela. Código errado aqui produz frase errada, não exceção — e o código passou
 * a ir ao log, então a primeira ocorrência de cada um fica auditável.
 */
const META_ERROR_NOTICES: Record<string, string> = {
  '131047': REENGAGEMENT_NOTICE,
  '131026':
    'o WhatsApp não conseguiu entregar a mensagem a este número. Em geral é número ' +
    'sem WhatsApp ativo, ou uma conta que não aceita receber deste remetente. ' +
    'Confira o telefone no CRM antes de tentar de novo.',
  '131048':
    'a Meta bloqueou novos envios deste número por limite de spam. Aguarde antes de ' +
    'tentar de novo e reveja o volume de mensagens disparadas.',
  '131049':
    'a Meta recusou esta mensagem de marketing para preservar o engajamento do ' +
    'contato. Não é falha da linha: este contato não vai receber envios de marketing ' +
    'agora.',
  '131051':
    'o tipo desta mensagem não é aceito pelo WhatsApp Oficial. Reenvie como texto ou ' +
    'como um anexo de tipo suportado.',
  '132000':
    'o template foi enviado com um número de variáveis diferente do que a Meta ' +
    'aprovou. Confira os campos do template antes de reenviar.',
  '132001':
    'este template não existe na conta do WhatsApp Oficial (ou não está aprovado no ' +
    'idioma usado). Escolha um template aprovado na lista do widget.',
  '132015':
    'a Meta pausou este template por baixa qualidade, e ele não envia enquanto ' +
    'estiver pausado. Use outro template aprovado.',
  '132016':
    'este template foi desativado pela Meta e não envia mais. Use outro template ' +
    'aprovado.',
}

type FailurePattern = {
  /** Todos em minúsculas — a comparação normaliza o texto do erro. */
  match: string[]
  notice: string
}

const PATTERNS: FailurePattern[] = [
  {
    match: ['display name approval', 'display name'],
    notice:
      'o número deste WhatsApp Oficial ainda não teve o nome de exibição aprovado ' +
      'pela Meta, e nenhuma mensagem sai até a aprovação sair. A liberação é feita no ' +
      'Gerenciador do WhatsApp da conta Meta do cliente.',
  },
  {
    match: [
      're-engagement',
      'reengagement',
      '24 hours',
      '24 horas',
      'outside the allowed window',
      'conversation window',
    ],
    notice: REENGAGEMENT_NOTICE,
  },
  {
    match: [
      'not a valid whatsapp user',
      'not a whatsapp user',
      'invalid phone',
      'invalid recipient',
      'recipient phone number not in allowed list',
    ],
    notice:
      'o número do contato não tem WhatsApp ativo (ou está escrito de forma ' +
      'inválida). Confira o telefone no CRM antes de tentar de novo.',
  },
  {
    match: ['rate limit', 'throughput', 'too many requests', 'limit reached'],
    notice:
      'o limite de envio da Meta para este número foi atingido. Tente de novo em ' +
      'alguns instantes.',
  },
]

/**
 * Os erros da Meta dentro do item de estado, sempre como array.
 *
 * `Array.isArray` e não confiança no tipo: o payload vem de webhook externo, e um
 * `errors` que chegasse como objeto viraria `undefined.length` em produção.
 */
export function readMetaErrors(
  stateItem: HubMessageStateItem | undefined,
): HubMessageDeliveryError[] {
  const errors = stateItem?.external_information?.errors
  if (!Array.isArray(errors)) return []
  return errors.filter(
    (error): error is HubMessageDeliveryError =>
      typeof error === 'object' && error !== null,
  )
}

/**
 * O primeiro código presente em `errors[]`, mapeado ou não.
 *
 * Serve ao log: registrar `131099` desconhecido é o que permite descobrir que ele
 * existe e merece uma linha na tabela. Para a tradução vale a busca por conhecido
 * (abaixo), que é outra coisa.
 */
export function readMetaErrorCode(
  stateItem: HubMessageStateItem | undefined,
): string | undefined {
  for (const error of readMetaErrors(stateItem)) {
    const code = normalizeCode(error.code)
    if (code) return code
  }
  return undefined
}

/**
 * O primeiro código **mapeado**, varrendo todos os erros e não só o primeiro.
 *
 * Um `errors[]` com dois itens onde só o segundo é conhecido tem de ser traduzido pelo
 * segundo; parar no primeiro faria a ordem do array decidir se o operador recebe uma
 * frase útil ou o texto genérico.
 */
function findKnownMetaErrorCode(
  errors: HubMessageDeliveryError[],
): string | undefined {
  for (const error of errors) {
    const code = normalizeCode(error.code)
    if (code && code in META_ERROR_NOTICES) return code
  }
  return undefined
}

/**
 * `code` chega como string no payload observado, mas a Cloud API o documenta como
 * número — os dois são aceitos e normalizados para string, que é a chave da tabela.
 */
function normalizeCode(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

/**
 * Todo o texto disponível sobre a falha, unido por espaço: `title`, `message` e
 * `error_data.details` de **cada** erro, mais o `failedDescription`.
 *
 * Concatena em vez de escolher o "melhor" campo: eles são redundantes entre si em
 * graus que variam por erro (`title` e `message` vieram idênticos no `131047`), e
 * escolher exigiria saber de antemão qual vem preenchido em cada caso. Repetição não
 * cria termo novo, então concatenar não inventa casamento de substring.
 */
export function buildFailureText(
  stateItem: HubMessageStateItem | undefined,
): string {
  /** Aceita `undefined` na coleta; o filtro abaixo é quem estreita para `string`. */
  const parts: Array<string | undefined> = []

  for (const error of readMetaErrors(stateItem)) {
    parts.push(error.title, error.message, error.error_data?.details)
  }
  parts.push(stateItem?.state?.failedDescription)

  return parts
    .filter((part): part is string => typeof part === 'string' && !!part.trim())
    .map(part => part.trim())
    .join(' ')
}

/**
 * Frase pronta para postar no chat do canal aberto.
 *
 * Sem nenhuma fonte de motivo (callback de erro sem `errors[]` e sem
 * `failedDescription`) ainda produz aviso: "não foi entregue e não sabemos por quê" é
 * informação, e o silêncio é pior.
 */
export function describeHubMessageDeliveryFailure(
  stateItem: HubMessageStateItem | undefined,
): string {
  const errors = readMetaErrors(stateItem)
  const text = buildFailureText(stateItem)

  const knownCode = findKnownMetaErrorCode(errors)
  if (knownCode) return PREFIX + META_ERROR_NOTICES[knownCode]

  if (!text) {
    return (
      PREFIX +
      'o WhatsApp Oficial recusou o envio e não informou o motivo. ' +
      'Verifique a conexão da linha e tente novamente.'
    )
  }

  const haystack = text.toLowerCase()
  const pattern = PATTERNS.find(({ match }) =>
    match.some(term => haystack.includes(term)),
  )

  if (pattern) return PREFIX + pattern.notice

  /**
   * Genérico com o código à vista quando houver um: "erro 131099" é um número
   * pesquisável na documentação da Meta, e é a única coisa acionável que sobra quando
   * nem o código nem o texto são reconhecidos.
   */
  const code = readMetaErrorCode(stateItem)
  const codeSuffix = code ? ` (erro ${code})` : ''

  return (
    PREFIX +
    `o WhatsApp Oficial recusou o envio${codeSuffix}. Retorno do provedor: ` +
    truncate(text, RAW_DESCRIPTION_MAX_CHARS)
  )
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}
