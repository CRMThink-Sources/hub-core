import type { HandoffTarget } from './flow'

// Parâmetros de `imopenlines.bot.session.transfer`. O método aceita um destino só —
// `TRANSFER_ID: 'queue'` (a fila da própria linha), `USER_ID` (um atendente) ou `QUEUE_ID`,
// que na doc de `imopenlines.operator.transfer` é o `ID` de `imopenlines.config.list.get`,
// o mesmo `lineId` do vínculo. Não existe transferir para uma lista de atendentes, então a
// distribuição escolhida no editor vira um destes três:
//
// - `queue` / `line` → a fila do canal, que distribui pela config do próprio canal aberto;
// - `evenly` → um dos selecionados, por rodízio (ver `escolheUniformemente`);
// - `all` → a fila do canal, que é quem avisa todos os operadores. A lista fica gravada
//   como intenção; quem entrega é a config do canal aberto.
//
// `LEAVE: 'Y'` sempre: sem sair, o bot segue no chat e o próximo webhook recomeçaria o
// fluxo por cima do atendimento humano. `CLIENT_ID` é o `botToken` do registro, exigido
// porque nosso bot é `eventMode: 'webhook'` — sem ele o Bitrix não identifica o chamador.
export type TransferParams = {
  CHAT_ID: string
  LEAVE: 'Y'
  CLIENT_ID: string
  TRANSFER_ID?: 'queue'
  USER_ID?: string
  QUEUE_ID?: string
}

export function transferParams(
  chatId: string,
  target: HandoffTarget,
  clientId: string,
): TransferParams {
  const base = { CHAT_ID: chatId, LEAVE: 'Y', CLIENT_ID: clientId } as const

  switch (target.type) {
    case 'queue':
    case 'all':
      return { ...base, TRANSFER_ID: 'queue' }
    case 'line':
      return { ...base, QUEUE_ID: target.lineId }
    case 'evenly':
      return {
        ...base,
        USER_ID: escolheUniformemente(chatId, target.bitrixUserIds),
      }
  }
}

/**
 * Rodízio sem estado: o índice sai do `chatId`, então a mesma conversa cai sempre no mesmo
 * atendente (reprocessar o webhook não troca quem recebeu) e conversas diferentes se
 * espalham pela lista. Guardar um contador exigiria uma tabela só para isso.
 */
function escolheUniformemente(chatId: string, ids: string[]): string {
  const validos = ids.map(id => id.trim()).filter(Boolean)
  if (validos.length === 0) return ''

  let hash = 0
  for (const char of chatId) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_003

  return validos[hash % validos.length] as string
}

// A publicação já barra lista vazia, mas a sessão roda com um snapshot do grafo: atendente
// removido do portal chegaria aqui sem id, o Bitrix responderia `TRANSFER_ID_EMPTY` e o
// cliente ficaria esperando alguém que ninguém chamou.
export function isTargetExecutable(target: HandoffTarget): boolean {
  switch (target.type) {
    case 'queue':
    case 'all':
      return true
    case 'line':
      return target.lineId.trim() !== ''
    case 'evenly':
      return target.bitrixUserIds.some(id => id.trim() !== '')
  }
}
