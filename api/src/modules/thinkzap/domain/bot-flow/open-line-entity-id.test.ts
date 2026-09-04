import { describe, expect, it } from 'vitest'
import {
  openLineIdFromDialog,
  parseOpenLineIdFromEntityId,
} from './open-line-entity-id'

describe('parseOpenLineIdFromEntityId', () => {
  it('extrai o CONFIG_ID do formato connector|openline|chat|user', () => {
    // Exemplo da doc de `imopenlines.dialog.get`: a linha é o campo 2.
    expect(parseOpenLineIdFromEntityId('livechat|22|1775|599')).toBe('22')
    expect(parseOpenLineIdFromEntityId('whatsappbytwilio|224|998|31')).toBe(
      '224',
    )
  })

  it('recusa forma com número de campos diferente', () => {
    // Posicional falha em silêncio: com um campo a mais, o índice 1 devolveria outro id
    // e o bot rodaria o fluxo de um canal que não é este.
    expect(parseOpenLineIdFromEntityId('livechat|22|1775')).toBeNull()
    expect(parseOpenLineIdFromEntityId('livechat|22|1775|599|extra')).toBeNull()
    expect(parseOpenLineIdFromEntityId('livechat')).toBeNull()
  })

  it('recusa linha não numérica', () => {
    // `CONFIG_ID` é inteiro; vazio ou texto no lugar é forma quebrada.
    expect(parseOpenLineIdFromEntityId('livechat||1775|599')).toBeNull()
    expect(parseOpenLineIdFromEntityId('livechat|abc|1775|599')).toBeNull()
  })

  it('recusa entrada que não é string', () => {
    expect(parseOpenLineIdFromEntityId(undefined)).toBeNull()
    expect(parseOpenLineIdFromEntityId(null)).toBeNull()
    expect(parseOpenLineIdFromEntityId(22)).toBeNull()
  })
})

describe('openLineIdFromDialog', () => {
  it('lê a linha da resposta de dialog.get', () => {
    const resposta = {
      result: {
        id: 1777,
        entity_type: 'LINES',
        entity_id: 'livechat|22|1775|599',
        message_type: 'L',
      },
    }

    expect(openLineIdFromDialog(resposta)).toBe('22')
  })

  it('aceita entity_type ausente', () => {
    // Nem toda versão do portal devolve o campo; o `entity_id` já é a prova de forma.
    expect(
      openLineIdFromDialog({ result: { entity_id: 'livechat|22|1775|599' } }),
    ).toBe('22')
  })

  it('recusa chat que não é de canal aberto', () => {
    // Chat de CRM ou de grupo não tem linha: seguir com ele rodaria `advance` por um
    // vínculo inexistente.
    const resposta = {
      result: { entity_type: 'CRM', entity_id: 'DEAL|1209|0|0' },
    }

    expect(openLineIdFromDialog(resposta)).toBeNull()
  })

  it('recusa resposta vazia', () => {
    expect(openLineIdFromDialog(undefined)).toBeNull()
    expect(openLineIdFromDialog({})).toBeNull()
    expect(openLineIdFromDialog({ result: {} })).toBeNull()
  })
})
