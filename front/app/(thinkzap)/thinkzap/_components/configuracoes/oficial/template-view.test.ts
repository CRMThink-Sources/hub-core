import { describe, expect, it } from 'vitest'
import type { ConnectorTemplate } from '@/app/hooks/use-connector-templates'
import {
  canEditTemplate,
  categoryLocked,
  EMPTY_FILTERS,
  filterTemplates,
  formInitialOf,
  hasActiveFilters,
  previewSegments,
} from './template-view'

const template = (
  overrides: Partial<ConnectorTemplate> = {},
): ConnectorTemplate => ({
  id: 'tpl_1',
  name: 'promo_natal',
  category: 'MARKETING',
  language: 'pt_BR',
  status: 'APPROVED',
  components: [{ type: 'BODY', text: 'Promoção de Natal para {{1}}' }],
  ...overrides,
})

const list = [
  template(),
  template({ id: 'tpl_2', name: 'promo_pascoa', status: 'REJECTED' }),
  template({
    id: 'tpl_3',
    name: 'boleto_vencido',
    category: 'UTILITY',
    status: 'PENDING',
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Seu boleto venceu' },
    ],
  }),
]

describe('filterTemplates', () => {
  it('busca por nome', () => {
    expect(
      filterTemplates(list, { ...EMPTY_FILTERS, query: 'promo' }).map(
        t => t.name,
      ),
    ).toEqual(['promo_natal', 'promo_pascoa'])
  })

  it('busca pelo corpo, sem diferenciar acento nem maiúscula', () => {
    expect(
      filterTemplates(list, { ...EMPTY_FILTERS, query: 'PROMOCAO' }).map(
        t => t.name,
      ),
    ).toEqual(['promo_natal', 'promo_pascoa'])
  })

  it('combina status, categoria e "com imagem"', () => {
    expect(
      filterTemplates(list, { ...EMPTY_FILTERS, status: 'REJECTED' }).map(
        t => t.name,
      ),
    ).toEqual(['promo_pascoa'])
    expect(
      filterTemplates(list, {
        ...EMPTY_FILTERS,
        category: 'UTILITY',
        onlyImage: true,
      }).map(t => t.name),
    ).toEqual(['boleto_vencido'])
  })

  it('nada encontrado devolve lista vazia', () => {
    expect(
      filterTemplates(list, { ...EMPTY_FILTERS, query: 'inexistente' }),
    ).toEqual([])
  })

  it('sabe quando há filtro ativo', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, onlyImage: true })).toBe(true)
  })
})

describe('edição', () => {
  it('só aprovado e rejeitado são editáveis', () => {
    expect(canEditTemplate('APPROVED')).toBe(true)
    expect(canEditTemplate('REJECTED')).toBe(true)
    expect(canEditTemplate('PENDING')).toBe(false)
  })

  it('categoria trava só em aprovado', () => {
    expect(categoryLocked('APPROVED')).toBe(true)
    expect(categoryLocked('REJECTED')).toBe(false)
  })

  it('monta o estado inicial a partir dos componentes da Meta', () => {
    const initial = formInitialOf(
      template({
        components: [
          {
            type: 'HEADER',
            format: 'IMAGE',
            example: { header_handle: ['https://scontent.whatsapp.net/x'] },
          },
          {
            type: 'BODY',
            text: 'Olá {{1}}, pedido {{2}}',
            example: { body_text: [['Ana', 'PED-1']] },
          },
          { type: 'FOOTER', text: 'Loja' },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'URL',
                text: 'Rastrear',
                url: 'https://loja.com/{{1}}',
                example: ['https://loja.com/1'],
              },
              { type: 'COPY_CODE', example: ['CUPOM'] } as never,
            ],
          },
        ],
      }),
    )

    expect(initial).toMatchObject({
      name: 'promo_natal',
      header: 'IMAGE',
      body: 'Olá {{1}}, pedido {{2}}',
      footer: 'Loja',
      examples: { 1: 'Ana', 2: 'PED-1' },
    })
    expect(initial.buttons).toEqual([
      {
        type: 'URL',
        text: 'Rastrear',
        url: 'https://loja.com/{{1}}',
        example: ['https://loja.com/1'],
      },
      { type: 'COPY_CODE', example: 'CUPOM' },
    ])
  })
})

describe('previewSegments', () => {
  it('destaca as variáveis', () => {
    expect(previewSegments('Olá {{1}}, sua oferta chegou')).toEqual([
      { text: 'Olá ', variable: false },
      { text: '{{1}}', variable: true },
      { text: ', sua oferta chegou', variable: false },
    ])
  })
})
