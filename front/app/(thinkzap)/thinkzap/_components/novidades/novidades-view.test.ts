import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import ptPage from '@/messages/pt/thinkzap/novidades/page.json'
import type { ThinkzapNovidade } from '../../_lib/get-thinkzap-novidades'
import {
  NovidadesView,
  type NovidadesState,
  type NovidadesTab,
} from './novidades-view'

const i18n = i18next.createInstance()

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'pt',
    resources: { pt: { 'thinkzap/novidades/page': ptPage } },
    interpolation: { escapeValue: false },
  })
})

const render = (
  state: NovidadesState,
  defaultTab?: NovidadesTab,
  defaultOpenId?: string | null,
) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(NovidadesView, {
        state,
        locale: 'pt',
        onRetry: () => {},
        defaultTab,
        defaultOpenId,
      }),
    ),
  )

const ITEMS: ThinkzapNovidade[] = [
  {
    id: 'a1',
    title: 'Envio de áudio',
    description: 'Agora dá para enviar áudios.',
    imageUrl: 'https://storage.test/audio.png',
    status: 'available',
    availableAt: '2026-10-12T12:00:00.000Z',
  },
  {
    id: 's1',
    title: 'Agendamento de mensagens',
    description: 'Em preparação.',
    imageUrl: null,
    status: 'soon',
  },
  {
    id: 's2',
    title: 'Respostas rápidas',
    description: 'Em preparação.',
    imageUrl: null,
    status: 'soon',
  },
]

/** Trecho do painel visível (o Base UI não monta o painel inativo). */
const selectedTab = (html: string) =>
  /<button[^>]*aria-selected="true"[^>]*>(.*?)<\/button>/.exec(html)?.[1]

describe('NovidadesView', () => {
  it('abre com todas as linhas recolhidas, sem descrição nem imagem', () => {
    const html = render({ status: 'ready', items: ITEMS })
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('aria-expanded="true"')
    expect(html).not.toContain('Agora dá para enviar áudios.')
    expect(html).not.toContain('<img')
  })

  it('linha aberta mostra descrição e imagem dentro do registro', () => {
    const html = render({ status: 'ready', items: ITEMS }, undefined, 'a1')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Agora dá para enviar áudios.')
    expect(html).toContain('https://storage.test/audio.png')
  })

  it('só uma linha fica aberta por vez', () => {
    const items: ThinkzapNovidade[] = [
      ...ITEMS,
      {
        ...ITEMS[0],
        id: 'a2',
        title: 'Outra',
        description: 'Outra descrição.',
      },
    ]
    const html = render({ status: 'ready', items }, undefined, 'a2')
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1)
    expect(html).toContain('Outra descrição.')
    expect(html).not.toContain('Agora dá para enviar áudios.')
  })

  it('abre em "Já disponível" com as linhas disponíveis e a data', () => {
    const html = render({ status: 'ready', items: ITEMS })
    expect(selectedTab(html)).toContain('Já disponível')
    expect(html).toContain('Em breve (2)')
    expect(html).toContain('Envio de áudio')
    expect(html).toContain('12 de outubro de 2026')
    expect(html).not.toContain('Agendamento de mensagens')
  })

  it('"Em breve" mostra as linhas com selo e sem nenhuma data', () => {
    const html = render({ status: 'ready', items: ITEMS }, 'soon')
    expect(selectedTab(html)).toContain('Em breve (2)')
    expect(html).toContain('Agendamento de mensagens')
    expect(html).toContain('Respostas rápidas')
    expect(html).not.toContain('Envio de áudio')
    expect(html).not.toContain('<time')
    expect(html).not.toContain('2026')
  })

  it('mostra o vazio próprio de cada aba', () => {
    const onlyAvailable = ITEMS.filter(item => item.status === 'available')
    const soonHtml = render({ status: 'ready', items: onlyAvailable }, 'soon')
    expect(soonHtml).toContain('Em breve (0)')
    expect(soonHtml).toContain('Nada previsto por enquanto')

    const availableHtml = render({ status: 'ready', items: [] })
    expect(availableHtml).toContain('Nenhuma novidade por aqui ainda')
  })

  it('carregando não mostra abas', () => {
    const html = render({ status: 'loading' })
    expect(html).toContain('Carregando novidades…')
    expect(html).not.toContain('role="tab"')
  })

  it('erro mostra a mensagem e "Tentar de novo"', () => {
    const html = render({ status: 'error' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Não foi possível carregar as novidades.')
    expect(html).toContain('Tentar de novo')
  })
})
