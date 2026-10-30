import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ProductUpdateCard,
  formatProductUpdateDate,
  type ProductUpdateCardData,
} from './product-update-card'

const LABELS = { available: 'Disponível', soon: 'Em breve' }
// Meio-dia UTC: o mesmo dia em qualquer fuso de quem roda o teste.
const AVAILABLE_AT = '2026-10-12T12:00:00.000Z'

const render = (update: ProductUpdateCardData, locale = 'pt') =>
  renderToStaticMarkup(
    createElement(ProductUpdateCard, { update, labels: LABELS, locale }),
  )

describe('ProductUpdateCard', () => {
  it('mostra imagem, título, descrição e selo disponível com data', () => {
    const html = render({
      title: 'Envio de áudio',
      description: 'Agora dá para enviar áudios.',
      imageUrl: 'https://cdn.exemplo.com/audio.png',
      status: 'available',
      availableAt: AVAILABLE_AT,
    })
    expect(html).toContain('src="https://cdn.exemplo.com/audio.png"')
    expect(html).toContain('Envio de áudio')
    expect(html).toContain('Agora dá para enviar áudios.')
    expect(html).toContain('Disponível')
    expect(html).toContain(`<time dateTime="${AVAILABLE_AT}"`)
    expect(html).toContain('12 de outubro de 2026')
  })

  it('sem imagem não renderiza <img> e preserva quebras de linha', () => {
    const html = render({
      title: 'Filtros nos logs',
      description: 'Primeira linha\nSegunda linha',
      imageUrl: null,
      status: 'available',
      availableAt: AVAILABLE_AT,
    })
    expect(html).not.toContain('<img')
    expect(html).toContain('Primeira linha\nSegunda linha')
    expect(html).toContain('whitespace-pre-line')
  })

  it('"Em breve" não mostra data, mesmo se vier availableAt', () => {
    const html = render({
      title: 'Agendamento de mensagens',
      description: 'Em preparação.',
      imageUrl: null,
      status: 'soon',
      availableAt: AVAILABLE_AT,
    })
    expect(html).toContain('Em breve')
    expect(html).not.toContain('Disponível')
    expect(html).not.toContain('<time')
    expect(html).not.toContain('2026')
  })

  it('formata a data no idioma pedido', () => {
    expect(formatProductUpdateDate(AVAILABLE_AT, 'en')).toBe('October 12, 2026')
    expect(formatProductUpdateDate(AVAILABLE_AT, 'es')).toBe(
      '12 de octubre de 2026',
    )
    expect(formatProductUpdateDate('não é data', 'pt')).toBeNull()
  })
})
