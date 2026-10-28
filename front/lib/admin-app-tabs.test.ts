import { describe, expect, it } from 'vitest'
import pt from '@/messages/pt/admin/app-settings.json'
import {
  APP_TAB_LABEL_KEY,
  availableAppTabs,
  isTechnicalTab,
  resolveAppTab,
} from './admin-app-tabs'

describe('availableAppTabs', () => {
  it('app que não é ThinkZap: só Visão geral e Assinaturas', () => {
    expect(availableAppTabs(false)).toEqual(['visao-geral', 'assinaturas'])
  })

  it('ThinkZap: Visão geral, Assinaturas, Linhas e o grupo técnico, nessa ordem', () => {
    expect(availableAppTabs(true)).toEqual([
      'visao-geral',
      'assinaturas',
      'linhas',
      'implantacao',
      'placements',
      'robos',
      'provedores-sms',
    ])
  })
})

describe('resolveAppTab', () => {
  it('abre a aba do endereço', () => {
    expect(resolveAppTab('assinaturas', false)).toBe('assinaturas')
    expect(resolveAppTab('robos', true)).toBe('robos')
  })

  it('sem aba, ou aba desconhecida, abre a Visão geral', () => {
    expect(resolveAppTab(null, true)).toBe('visao-geral')
    expect(resolveAppTab('inexistente', true)).toBe('visao-geral')
  })

  it('aba de ThinkZap numa app que não é ThinkZap cai na Visão geral', () => {
    expect(resolveAppTab('linhas', false)).toBe('visao-geral')
  })
})

describe('isTechnicalTab', () => {
  it('só as abas do grupo técnico', () => {
    expect(isTechnicalTab('implantacao')).toBe(true)
    expect(isTechnicalTab('linhas')).toBe(false)
  })
})

describe('APP_TAB_LABEL_KEY', () => {
  it('todo rótulo de aba existe nas mensagens', () => {
    const tabs = (pt as { tabs: Record<string, string> }).tabs
    for (const key of Object.values(APP_TAB_LABEL_KEY)) {
      expect(typeof tabs[key.replace('tabs.', '')], key).toBe('string')
    }
  })
})
