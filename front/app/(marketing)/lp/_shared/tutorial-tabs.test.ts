import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LpBaseContent, Tutorial } from './content'
import { BitrixMenu, HotspotButton, type TutorialView } from './frame'
import { LpContentProvider } from './lp-content-context'
import { TutorialTabs } from './tutorial-tabs'

const CONTENT = {
  player: {
    tabsLabel: 'Tutoriais',
    variantsLabel: (tutorial: string) => `Variantes de ${tutorial}`,
    done: 'Concluído',
    stepOf: (step: number, total: number) => `Passo ${step} de ${total}`,
    hint: 'Clique em',
    back: 'Voltar',
    next: 'Próximo',
    finish: 'Concluir',
    goToStep: (step: number, title: string) => `Passo ${step}: ${title}`,
    restart: 'Recomeçar',
    nextTutorial: (label: string) => `Próximo: ${label}`,
  },
  frame: {
    bitrixMenu: {
      crm: 'CRM',
      openChannels: 'Canais abertos',
      app: 'ImportSheet',
      market: 'Market',
    },
    portalHost: 'empresa.bitrix24.com.br',
  },
  ctaButtons: { install: 'Instalar', whatsapp: 'WhatsApp' },
} as unknown as LpBaseContent

const TUTORIALS: Tutorial<'upload', 'importar'>[] = [
  {
    slug: 'importar',
    label: 'Importar',
    summary: 'Da planilha ao CRM.',
    steps: [
      { screen: 'upload', title: 'Envie', description: '', action: 'Enviar' },
    ],
    done: { title: 'Pronto', description: '' },
  },
]

const Upload = ({
  action,
  onAdvance,
}: {
  action: string
  onAdvance: () => void
}) => createElement(HotspotButton, { action, onAdvance })

const AppAside = ({ active }: { active: 'importar' | 'logs' }) =>
  createElement('aside', { 'data-app-aside': active })

const render = (
  frame: TutorialView<'upload', 'importar' | 'logs'>['frames']['upload'],
) =>
  renderToStaticMarkup(
    createElement(TutorialTabs<'importar', 'importar' | 'logs'>, {
      content: CONTENT,
      tutorials: TUTORIALS,
      views: {
        importar: { screens: { upload: Upload }, frames: { upload: frame } },
      },
      appAside: AppAside,
      ctas: { marketUrl: null, whatsappLink: null },
    }),
  )

describe('TutorialTabs', () => {
  it('desenha a moldura `app` com o aside da LP', () => {
    const html = render({
      kind: 'app',
      path: 'marketplace/app/x/',
      menu: 'importar',
    })
    expect(html).toContain('data-app-aside="importar"')
    expect(html).toContain('empresa.bitrix24.com.br/marketplace/app/x/')
    expect(html).toContain('Passo 1 de 1')
    expect(html.match(/data-hotspot/g)).toHaveLength(1)
  })

  it('na moldura `bitrix` usa o menu do portal com o item do app', () => {
    const html = render({ kind: 'bitrix', path: 'crm/', menu: 'app' })
    expect(html).not.toContain('data-app-aside')
    expect(html).toMatch(/font-semibold text-white">ImportSheet</)
  })
})

describe('BitrixMenu', () => {
  it('mostra o rótulo do app vindo da copy', () => {
    const html = renderToStaticMarkup(
      createElement(LpContentProvider, {
        content: CONTENT,
        children: createElement(BitrixMenu, { active: 'crm' }),
      }),
    )
    expect(html).toContain('>ImportSheet</p>')
    expect(html).toMatch(/font-semibold text-white">CRM</)
  })
})
