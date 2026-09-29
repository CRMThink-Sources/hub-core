import { describe, expect, it } from 'vitest'
import {
  connectorChatIdFromDialog,
  contactNameFromDialog,
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

/** O destino do contato: a fala do bot não sai pelo Bitrix, então nós a entregamos. */
describe('connectorChatIdFromDialog', () => {
  it('lê o chat do conector, não o do canal aberto', () => {
    // Em `livechat|22|1775|599`: `22` é a linha e `1775` é o contato no provider. Trocar
    // os dois mandaria a mensagem para o número errado sem nenhum erro.
    const resposta = {
      result: { entity_type: 'LINES', entity_id: 'livechat|22|1775|599' },
    }

    expect(connectorChatIdFromDialog(resposta)).toBe('1775')
  })

  it('aceita identificador não numérico', () => {
    // Alguns conectores usam telefone, outros um id opaco: só a forma vazia é recusada.
    expect(
      connectorChatIdFromDialog({
        result: { entity_id: 'wa|230|5547999998888|31' },
      }),
    ).toBe('5547999998888')
  })

  it('recusa chat que não é de canal aberto', () => {
    expect(
      connectorChatIdFromDialog({
        result: { entity_type: 'CRM', entity_id: 'DEAL|1209|0|0' },
      }),
    ).toBeNull()
  })

  it('forma quebrada devolve nulo em vez de id errado', () => {
    expect(connectorChatIdFromDialog(undefined)).toBeNull()
    expect(connectorChatIdFromDialog({ result: {} })).toBeNull()
    // Partes a menos: pegar o índice 2 de qualquer jeito devolveria outra coisa.
    expect(
      connectorChatIdFromDialog({ result: { entity_id: 'livechat|22' } }),
    ).toBeNull()
    expect(
      connectorChatIdFromDialog({ result: { entity_id: 'livechat|22||599' } }),
    ).toBeNull()
  })
})

describe('contactNameFromDialog', () => {
  // Medido 2026-09-24 (chat 9644): a resposta traz `name`, não `title`. Lendo o campo
  // errado, `{bitrix.name}` saía vazio na saudação — o único turno sem autor no evento.
  it('lê o nome do chat e corta o nome da linha', () => {
    expect(
      contactNameFromDialog({
        result: { name: 'Gustavo Henrique - Teste Amanda - Gerais' },
      }),
      // Corta no primeiro separador: a linha do exemplo também tem " - ".
    ).toBe('Gustavo Henrique')
  })

  it('aceita `title` para não depender da forma de uma versão só', () => {
    expect(
      contactNameFromDialog({ result: { title: 'Maria - Suporte' } }),
    ).toBe('Maria')
  })

  it('chat só com o nome do contato sai inteiro', () => {
    expect(contactNameFromDialog({ result: { name: 'Gustavo' } })).toBe(
      'Gustavo',
    )
  })

  it('sem nome ainda devolve vazio, não quebra a fala', () => {
    expect(contactNameFromDialog({ result: {} })).toBe('')
    expect(contactNameFromDialog(undefined)).toBe('')
  })
})
