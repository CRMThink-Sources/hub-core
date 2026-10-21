import { describe, expect, it } from 'vitest'
import {
  clientMessageIdsOf,
  describeOutboxStatus,
  isQueuedResponse,
  mergeStatuses,
  outboxStatusUrl,
  pendingIds,
  type OutboxStatusEntry,
} from './outbox-status.client'

// 13:05:40Z = 10:05 em Brasília.
const WAIT_UNTIL = '2026-10-21T13:05:40.000Z'

const entry = (
  clientMessageId: string,
  status: OutboxStatusEntry['status'],
  waitUntil: string | null = null,
): OutboxStatusEntry => ({ clientMessageId, status, waitUntil })

describe('acompanhamento de mensagens da fila no widget', () => {
  it('Mensagem do widget durante a pausa: mostra a espera com o horário previsto', () => {
    expect(describeOutboxStatus(entry('a', 'waiting', WAIT_UNTIL))).toBe(
      'Aguardando janela de envio · sai às 10:05',
    )
  })

  it('quando sai, passa a mostrar enviada', () => {
    const antes = { a: entry('a', 'waiting', WAIT_UNTIL) }
    const depois = mergeStatuses(antes, { messages: [entry('a', 'sent')] })

    expect(describeOutboxStatus(depois.a)).toBe('Enviada')
  })

  it('falha mostra o status de falha', () => {
    expect(describeOutboxStatus(entry('a', 'failed'))).toMatch(/Não entregue/)
  })

  it('id sem leitura ainda aparece como na fila', () => {
    expect(describeOutboxStatus(undefined)).toBe('Na fila de envio')
  })

  it('a consulta para quando todos os ids estão em estado final', () => {
    const statuses = {
      a: entry('a', 'sent'),
      b: entry('b', 'failed'),
      c: entry('c', 'waiting', WAIT_UNTIL),
    }

    expect(pendingIds(['a', 'b', 'c', 'd'], statuses)).toEqual(['c', 'd'])
    expect(
      pendingIds(['a', 'b'], { ...statuses, c: entry('c', 'unknown') }),
    ).toEqual([])
  })

  it('ids de qualquer rota de envio', () => {
    expect(clientMessageIdsOf({ clientMessageId: 'x' })).toEqual(['x'])
    expect(clientMessageIdsOf({ clientMessageIds: ['a', 'b'] })).toEqual([
      'a',
      'b',
    ])
    // Envio com anexo pelo caminho síncrono antigo não tem o que acompanhar.
    expect(clientMessageIdsOf({ sentMessageIds: ['p1'] })).toEqual([])
    expect(clientMessageIdsOf(null)).toEqual([])
  })

  it('reconhece a resposta enfileirada do envio com anexo', () => {
    expect(isQueuedResponse({ status: 'queued', clientMessageIds: [] })).toBe(
      true,
    )
    expect(isQueuedResponse({ message: 'Message sent successfully' })).toBe(
      false,
    )
  })

  it('monta a URL com os ids codificados', () => {
    expect(outboxStatusUrl(['g:0', 'g:1'])).toBe(
      '/thinkzap/messages/outbox-status?ids=g%3A0,g%3A1',
    )
  })
})
