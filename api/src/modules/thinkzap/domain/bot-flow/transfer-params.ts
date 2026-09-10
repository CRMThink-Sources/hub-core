import type { HandoffTarget } from './flow'

// Parâmetros de `imopenlines.bot.session.transfer`. Um método serve aos três alvos e só o
// parâmetro muda: `queue` → `TRANSFER_ID: 'queue'` (a fila da própria linha), `user` →
// `USER_ID`, `line` → `QUEUE_ID`, que na doc de `imopenlines.operator.transfer` é o `ID` de
// `imopenlines.config.list.get` — o mesmo `lineId` do vínculo.
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
      return { ...base, TRANSFER_ID: 'queue' }
    case 'user':
      return { ...base, USER_ID: target.bitrixUserId }
    case 'line':
      return { ...base, QUEUE_ID: target.lineId }
  }
}

// A publicação já barra id vazio, mas a sessão roda com um snapshot do grafo: linha
// removida do portal chegaria aqui sem id, o Bitrix responderia `TRANSFER_ID_EMPTY` e o
// cliente ficaria esperando alguém que ninguém chamou.
export function isTargetExecutable(target: HandoffTarget): boolean {
  switch (target.type) {
    case 'queue':
      return true
    case 'user':
      return target.bitrixUserId.trim() !== ''
    case 'line':
      return target.lineId.trim() !== ''
  }
}
