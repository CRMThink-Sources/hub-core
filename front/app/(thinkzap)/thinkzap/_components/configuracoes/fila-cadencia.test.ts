import { describe, expect, it } from 'vitest'
import type { CadenceQueueItem } from '@/app/hooks/use-line-api'
import {
  conteudoDe,
  foraDaLista,
  mostrarFila,
  origemKey,
} from './fila-cadencia'

const item = (over: Partial<CadenceQueueItem> = {}): CadenceQueueItem => ({
  position: 1,
  origin: 'OPERATOR',
  destination: '5511999999999',
  preview: 'Bom dia!',
  mediaType: null,
  enqueuedAt: 0,
  waitUntil: null,
  ...over,
})

describe('tabela de mensagens aguardando', () => {
  it('rótulo da origem', () => {
    expect(origemKey(item({ origin: 'ROBOT_MESSAGE' }))).toBe(
      'cadenciador.fila.origens.ROBOT_MESSAGE',
    )
  })

  it('texto vai como veio; mídia ganha o tipo antes do nome', () => {
    expect(conteudoDe(item())).toEqual({ midiaKey: null, texto: 'Bom dia!' })
    expect(
      conteudoDe(item({ mediaType: 'document', preview: 'contrato.pdf' })),
    ).toEqual({
      midiaKey: 'cadenciador.fila.midia.document',
      texto: 'contrato.pdf',
    })
    expect(conteudoDe(item({ mediaType: 'image', preview: null }))).toEqual({
      midiaKey: 'cadenciador.fila.midia.image',
      texto: null,
    })
  })

  it('Mais de 50 aguardando: indica quantas ficaram de fora', () => {
    const messages = Array.from({ length: 50 }, (_, i) =>
      item({ position: i + 1 }),
    )
    expect(foraDaLista({ total: 120, messages })).toBe(70)
    expect(foraDaLista({ total: 3, messages: messages.slice(0, 3) })).toBe(0)
  })

  it('Fila vazia: a tabela não aparece', () => {
    expect(mostrarFila({ total: 0, messages: [] })).toBe(false)
    expect(mostrarFila(null)).toBe(false)
    expect(mostrarFila({ total: 1, messages: [item()] })).toBe(true)
  })
})
