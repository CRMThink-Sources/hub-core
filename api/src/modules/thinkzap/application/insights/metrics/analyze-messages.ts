export type AnalyzeMessage = {
  id: string | number
  senderId: string | number
  date: string
  text?: string
}

export type MessageRole = 'client' | 'operator' | 'bot' | 'system'

export type MessageAnalysis = {
  initiatedBy: 'client' | 'company' | null
  firstClient: string | null
  firstOperator: string | null
  lastOperator: string | null
  acceptedAt: string | null
  clientCode: string | null
  msgsOperator: number
  msgsClient: number
  msgsBot: number
  redirects: number
  replyTimes: number[]
  clientReplied: boolean | null
}

const ms = (d: string) => new Date(d).getTime()

/**
 * Métricas por conversa a partir das mensagens. A mesma regra vale para o REST
 * clássico e para a Vibe API, por isso o papel de cada remetente entra por
 * `role` em vez de ser inferido aqui.
 */
export function analyzeMessages(
  msgs: AnalyzeMessage[],
  role: (senderId: string) => MessageRole,
): MessageAnalysis {
  const list = [...msgs].sort(
    (a, b) => ms(a.date) - ms(b.date) || Number(a.id) - Number(b.id),
  )
  let initiatedBy: MessageAnalysis['initiatedBy'] = null
  let firstClient: string | null = null
  let firstOperator: string | null = null
  let lastOperator: string | null = null
  let acceptedAt: string | null = null
  let clientCode: string | null = null
  let msgsOperator = 0
  let msgsClient = 0
  let msgsBot = 0
  let redirects = 0
  let clientAfterOperator = false
  const replyTimes: number[] = []
  // 1ª mensagem do cliente ainda sem resposta humana
  let pendingClientAt: string | null = null

  for (const m of list) {
    const r = role(String(m.senderId))
    if (r === 'system') {
      if (!acceptedAt && /aceitou|accepted/i.test(m.text || '')) {
        acceptedAt = m.date
      }
      if (/redirecionad|transferid/i.test(m.text || '')) redirects++
      continue
    }
    if (r === 'bot') {
      msgsBot++
      continue
    }
    if (r === 'client') {
      msgsClient++
      clientCode ||= String(m.senderId)
      firstClient ||= m.date
      initiatedBy ||= 'client'
      if (firstOperator) clientAfterOperator = true
      pendingClientAt ||= m.date
    } else {
      msgsOperator++
      firstOperator ||= m.date
      lastOperator = m.date
      initiatedBy ||= 'company'
      if (pendingClientAt) {
        replyTimes.push(Math.max(0, (ms(m.date) - ms(pendingClientAt)) / 1000))
        pendingClientAt = null
      }
    }
  }
  return {
    initiatedBy,
    firstClient,
    firstOperator,
    lastOperator,
    acceptedAt,
    clientCode,
    msgsOperator,
    msgsClient,
    msgsBot,
    redirects,
    replyTimes,
    // "taxa de retorno": nas conversas que a empresa começou, o cliente respondeu?
    clientReplied: initiatedBy === 'company' ? clientAfterOperator : null,
  }
}
