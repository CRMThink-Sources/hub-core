import { describe, expect, it } from 'vitest'
import { advance } from './advance'
import type { BotFlowGraph } from './flow'
import {
  crmEntitiesFromDialog,
  crmVars,
  parseCrmEntities,
} from './crm-entities'

describe('parseCrmEntities', () => {
  it('lê os quatro vínculos do formato do portal', () => {
    expect(parseCrmEntities('LEAD|1209|COMPANY|0|CONTACT|0|DEAL|0')).toEqual({
      leadId: '1209',
      contactId: '',
      companyId: '',
      dealId: '',
    })
  })

  it('contato preenchido é quem separa cliente de desconhecido', () => {
    const { contactId } = parseCrmEntities(
      'LEAD|0|COMPANY|55|CONTACT|880|DEAL|31',
    )

    expect(contactId).toBe('880')
  })

  it('zero é ausência, não id', () => {
    // `'0'` é string não-vazia: sem o tratamento, `notEmpty` diria que o contato existe.
    expect(parseCrmEntities('CONTACT|0').contactId).toBe('')
  })

  it('ordem diferente não troca os ids', () => {
    // Lido por par e não por índice: a ordem dos tipos não é contrato do Bitrix.
    expect(parseCrmEntities('CONTACT|7|LEAD|9')).toMatchObject({
      contactId: '7',
      leadId: '9',
    })
  })

  it('tipo desconhecido no meio não desloca o resto', () => {
    expect(parseCrmEntities('LEAD|1|QUOTE|42|CONTACT|8')).toMatchObject({
      leadId: '1',
      contactId: '8',
    })
  })

  it('forma quebrada vira tudo vazio, não erro', () => {
    // O turno não pode cair porque o portal mudou o campo: sem vínculo o fluxo segue
    // pelo ramo "não é cliente", que é o caminho seguro.
    expect(parseCrmEntities(undefined).contactId).toBe('')
    expect(parseCrmEntities('').contactId).toBe('')
    expect(parseCrmEntities({ CONTACT: 9 }).contactId).toBe('')
    expect(parseCrmEntities('LEAD').leadId).toBe('')
  })
})

describe('crmEntitiesFromDialog', () => {
  it('lê da resposta crua de dialog.get', () => {
    const resposta = {
      result: {
        entity_type: 'LINES',
        entity_data_2: 'LEAD|0|COMPANY|0|CONTACT|1209|DEAL|0',
      },
    }

    expect(crmEntitiesFromDialog(resposta).contactId).toBe('1209')
  })

  it('resposta sem o campo não quebra', () => {
    expect(crmEntitiesFromDialog({ result: {} }).contactId).toBe('')
    expect(crmEntitiesFromDialog(null).contactId).toBe('')
  })
})

describe('crmVars', () => {
  it('expõe os nomes que o bloco pronto usa', () => {
    // Contrato com o editor: renomear aqui quebra todo fluxo publicado que os use.
    expect(
      crmVars(parseCrmEntities('LEAD|1|COMPANY|2|CONTACT|3|DEAL|4')),
    ).toEqual({
      leadId: '1',
      empresaId: '2',
      contatoId: '3',
      negocioId: '4',
    })
  })
})

/** O bloco "Já é cliente?" do editor decide antes de o cliente responder qualquer coisa. */
describe('condição de CRM no primeiro passo', () => {
  const graph = {
    entryNodeId: 'n1',
    settings: { escapeKeywords: [], escapeNext: null },
    nodes: [
      {
        id: 'n1',
        kind: 'condition',
        name: 'Já é cliente?',
        branches: [{ when: { var: 'contatoId', op: 'notEmpty' }, next: 'sim' }],
        otherwise: 'nao',
      },
      { id: 'sim', kind: 'message', text: 'Bom te ver de novo!', next: 'fim' },
      { id: 'nao', kind: 'message', text: 'Primeiro contato?', next: 'fim' },
      { id: 'fim', kind: 'finish' },
    ],
  } as unknown as BotFlowGraph

  function falas(vars: Record<string, string>): string {
    return advance(graph, null, { kind: 'start' }, vars)
      .effects.filter(effect => effect.kind === 'say')
      .map(effect => (effect as { text: string }).text)
      .join(' ')
  }

  it('contato existente vai pelo ramo de cliente', () => {
    expect(falas(crmVars(parseCrmEntities('CONTACT|1209')))).toContain(
      'Bom te ver de novo',
    )
  })

  it('sem contato cai no senão', () => {
    expect(falas(crmVars(parseCrmEntities('LEAD|55|CONTACT|0')))).toContain(
      'Primeiro contato',
    )
  })

  it('lead sozinho não conta como cliente', () => {
    // O Bitrix abre um lead no primeiro contato: usá-lo aqui diria que todo mundo já é
    // cliente, que é o erro que o `contatoId` evita.
    expect(falas(crmVars(parseCrmEntities('LEAD|55|CONTACT|0')))).not.toContain(
      'Bom te ver',
    )
  })

  it('sem semear nada segue pelo senão em vez de quebrar', () => {
    expect(falas({})).toContain('Primeiro contato')
  })
})
