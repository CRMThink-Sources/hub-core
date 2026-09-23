import { describe, expect, it } from 'vitest'
import type { HandoffTarget } from './flow'
import { isTargetExecutable, transferParams } from './transfer-params'

// `CLIENT_ID` do registro: obrigatório porque o bot é `eventMode: 'webhook'`.
const TOKEN = 'bot-token-1'

describe('transferParams', () => {
  it('fila da própria linha vai por TRANSFER_ID', () => {
    expect(transferParams('112', { type: 'queue' }, TOKEN)).toEqual({
      CHAT_ID: '112',
      LEAVE: 'Y',
      CLIENT_ID: TOKEN,
      TRANSFER_ID: 'queue',
    })
  })

  it('uniformemente com um atendente vai por USER_ID', () => {
    expect(
      transferParams('112', { type: 'evenly', bitrixUserIds: ['15'] }, TOKEN),
    ).toEqual({ CHAT_ID: '112', LEAVE: 'Y', CLIENT_ID: TOKEN, USER_ID: '15' })
  })

  it('uniformemente com vários: um só, sempre o mesmo para a mesma conversa', () => {
    // Reprocessar o webhook não pode trocar quem recebeu a conversa.
    const alvo: HandoffTarget = {
      type: 'evenly',
      bitrixUserIds: ['15', '16', '17'],
    }

    const primeiro = transferParams('112', alvo, TOKEN).USER_ID
    expect(transferParams('112', alvo, TOKEN).USER_ID).toBe(primeiro)
    expect(alvo.bitrixUserIds).toContain(primeiro)
  })

  it('uniformemente espalha entre conversas diferentes', () => {
    const alvo: HandoffTarget = {
      type: 'evenly',
      bitrixUserIds: ['15', '16', '17'],
    }

    const escolhidos = new Set(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(
        chatId => transferParams(chatId, alvo, TOKEN).USER_ID,
      ),
    )

    expect(escolhidos.size).toBeGreaterThan(1)
  })

  it('para todos cai na fila do canal, que é quem avisa os selecionados', () => {
    expect(
      transferParams(
        '112',
        { type: 'all', bitrixUserIds: ['15', '16'] },
        TOKEN,
      ),
    ).toEqual({
      CHAT_ID: '112',
      LEAVE: 'Y',
      CLIENT_ID: TOKEN,
      TRANSFER_ID: 'queue',
    })
  })

  it('outro canal vai por QUEUE_ID', () => {
    // `QUEUE_ID` é o `ID` de `imopenlines.config.list.get` — o mesmo do vínculo.
    expect(transferParams('112', { type: 'line', lineId: '7' }, TOKEN)).toEqual(
      {
        CHAT_ID: '112',
        LEAVE: 'Y',
        CLIENT_ID: TOKEN,
        QUEUE_ID: '7',
      },
    )
  })

  it('nunca manda dois destinos juntos', () => {
    // Bitrix não documenta a precedência; mandar dois é pedir comportamento sorteado.
    const alvos: HandoffTarget[] = [
      { type: 'queue' },
      { type: 'evenly', bitrixUserIds: ['15', '16'] },
      { type: 'all', bitrixUserIds: ['15', '16'] },
      { type: 'line', lineId: '7' },
    ]

    for (const alvo of alvos) {
      const params = transferParams('112', alvo, TOKEN)
      const destinos = [
        params.TRANSFER_ID,
        params.USER_ID,
        params.QUEUE_ID,
      ].filter(valor => valor !== undefined)

      expect(destinos).toHaveLength(1)
    }
  })

  it('bot sempre sai do chat', () => {
    // `LEAVE: 'N'` deixaria o bot no chat sem sessão nossa: webhook órfão reiniciaria
    // o fluxo por cima do atendimento humano.
    expect(transferParams('1', { type: 'queue' }, TOKEN).LEAVE).toBe('Y')
    expect(
      transferParams('1', { type: 'evenly', bitrixUserIds: ['2'] }, TOKEN)
        .LEAVE,
    ).toBe('Y')
    expect(
      transferParams('1', { type: 'line', lineId: '3' }, TOKEN).LEAVE,
    ).toBe('Y')
  })
})

describe('isTargetExecutable', () => {
  it('fila não tem id para faltar', () => {
    expect(isTargetExecutable({ type: 'queue' })).toBe(true)
  })

  it('id presente é executável', () => {
    expect(isTargetExecutable({ type: 'evenly', bitrixUserIds: ['15'] })).toBe(
      true,
    )
    expect(isTargetExecutable({ type: 'line', lineId: '7' })).toBe(true)
  })

  it('id vazio ou em branco não é', () => {
    // A publicação barra, mas a sessão roda com snapshot: o alvo pode ter sumido depois.
    expect(isTargetExecutable({ type: 'evenly', bitrixUserIds: [] })).toBe(
      false,
    )
    expect(
      isTargetExecutable({ type: 'evenly', bitrixUserIds: ['  ', ''] }),
    ).toBe(false)
    expect(isTargetExecutable({ type: 'line', lineId: '' })).toBe(false)
  })

  it('para todos executa mesmo sem lista: a fila do canal recebe', () => {
    expect(isTargetExecutable({ type: 'all', bitrixUserIds: [] })).toBe(true)
  })
})
