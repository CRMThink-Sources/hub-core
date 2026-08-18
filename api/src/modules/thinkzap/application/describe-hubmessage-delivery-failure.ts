/**
 * Traduz o erro cru da Meta, que a HubMessage repassa em
 * `contents[].state.failedDescription`, para uma frase que diz ao operador **o que
 * fazer**.
 *
 * O cru é inútil para quem está no canal aberto — vem como corpo HTTP da Cloud API
 * dentro de uma string ("Integration with meta-whatsapp failed (HTTP 400):
 * {\"messaging_product\":...}"). Mas é a única pista quando o padrão é novo, e por isso
 * ele **nunca** é descartado: vai sempre para o log estruturado, e no fallback também
 * para o chat, truncado.
 *
 * Padrão casado por substring em minúsculas, não por parse do JSON embutido: o formato
 * do corpo é da Meta, muda sem aviso, e um parse quebrado transformaria "erro
 * traduzido" em "erro ao traduzir o erro".
 */

/** Teto do trecho cru que vai ao chat. Linha longa vira parede de texto no canal. */
const RAW_DESCRIPTION_MAX_CHARS = 300

const PREFIX = '⚠️ Sua mensagem não foi entregue: '

type FailurePattern = {
  /** Todos em minúsculas — a comparação normaliza o `failedDescription`. */
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
    notice:
      'a janela de 24 horas desta conversa está fechada. Só um template aprovado ' +
      'reabre a conversa para o contato.',
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
 * Frase pronta para postar no chat do canal aberto.
 *
 * Sem descrição nenhuma (callback de erro sem `failedDescription`) ainda produz aviso:
 * "não foi entregue e não sabemos por quê" é informação, e o silêncio de hoje é
 * justamente o problema que esta change resolve.
 */
export function describeHubMessageDeliveryFailure(
  failedDescription: string | undefined,
): string {
  const raw = failedDescription?.trim()

  if (!raw) {
    return (
      PREFIX +
      'o WhatsApp Oficial recusou o envio e não informou o motivo. ' +
      'Verifique a conexão da linha e tente novamente.'
    )
  }

  const haystack = raw.toLowerCase()
  const pattern = PATTERNS.find(({ match }) =>
    match.some(term => haystack.includes(term)),
  )

  if (pattern) return PREFIX + pattern.notice

  return (
    PREFIX +
    'o WhatsApp Oficial recusou o envio. Retorno do provedor: ' +
    truncate(raw, RAW_DESCRIPTION_MAX_CHARS)
  )
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}
