import { describe, expect, it } from 'vitest'
import type { CadenceQueueItem } from '@/app/hooks/use-line-api'
import {
  conteudoDe,
  intervaloDe,
  offsetValido,
  temAnterior,
  temProxima,
  mostrarFila,
  origemKey,
} from './fila-cadencia'

const item = (over: Partial<CadenceQueueItem> = {}): CadenceQueueItem => ({
  position: 1,
  origin: 'OPERATOR',
  operatorName: null,
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

  it('Fila vazia: a tabela não aparece', () => {
    expect(mostrarFila({ total: 0, offset: 0, limit: 10, messages: [] })).toBe(
      false,
    )
    expect(mostrarFila(null)).toBe(false)
    expect(
      mostrarFila({ total: 1, offset: 0, limit: 10, messages: [item()] }),
    ).toBe(true)
  })
})

describe('paginação da tabela', () => {
  const pagina = (offset: number, total: number) => ({
    total,
    offset,
    limit: 10,
    messages: [item()],
  })

  it('Paginação de 10 em 10: o intervalo de cada página', () => {
    expect(intervaloDe(pagina(0, 23))).toEqual({
      inicio: 1,
      fim: 10,
      total: 23,
    })
    expect(intervaloDe(pagina(10, 23))).toEqual({
      inicio: 11,
      fim: 20,
      total: 23,
    })
    expect(intervaloDe(pagina(20, 23))).toEqual({
      inicio: 21,
      fim: 23,
      total: 23,
    })
  })

  it('anterior e próxima só quando existem', () => {
    expect([temAnterior(pagina(0, 23)), temProxima(pagina(0, 23))]).toEqual([
      false,
      true,
    ])
    expect([temAnterior(pagina(20, 23)), temProxima(pagina(20, 23))]).toEqual([
      true,
      false,
    ])
    expect(temProxima(pagina(0, 10))).toBe(false)
  })

  it('Página que deixou de existir: volta para a última que existe', () => {
    expect(offsetValido(20, 12)).toBe(10)
    expect(offsetValido(20, 10)).toBe(0)
    expect(offsetValido(10, 23)).toBe(10)
    expect(offsetValido(30, 0)).toBe(0)
  })
})
