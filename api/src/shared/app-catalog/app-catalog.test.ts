import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    appCodes: {
      thinkzap: 'local.marketplace.thinkzap',
      thinkanalise: 'local.marketplace.thinkanalise',
      importsheet: 'local.marketplace.importsheet',
      clicksign: 'local.marketplace.clicksign',
    },
  },
}))

import {
  listAppCatalog,
  resolveByAppCode,
  resolveByMarketplaceCode,
  thinkzapAppCodeId,
} from './app-catalog'

afterEach(() => {
  vi.resetModules()
})

describe('resolveByMarketplaceCode', () => {
  it('resolve o code do marketplace vindo da env para a identidade canônica', () => {
    expect(resolveByMarketplaceCode('local.marketplace.thinkzap')).toEqual({
      appCode: 'crmthink.thinkzap',
      appCodeId: 'crmthink.thinkzap',
      slug: 'thinkzap',
      requiresOperatorOAuth: true,
    })
  })

  it('também aceita o code canônico como entrada', () => {
    expect(resolveByMarketplaceCode('crmthink.thinkzap')?.slug).toBe('thinkzap')
  })

  it.each([
    ['local.marketplace.thinkanalise', 'thinkanalise'],
    ['local.marketplace.importsheet', 'importsheet'],
    ['local.marketplace.clicksign', 'clicksign'],
  ])('resolve %s para o slug %s', (code, slug) => {
    expect(resolveByMarketplaceCode(code)?.slug).toBe(slug)
  })

  it('devolve null para code desconhecido, sem cair em app default', () => {
    expect(resolveByMarketplaceCode('outro.app')).toBeNull()
  })

  it.each([['', undefined, null] as const].flat())(
    'devolve null para code ausente (%s)',
    code => {
      expect(resolveByMarketplaceCode(code)).toBeNull()
    },
  )

  it('marca requiresOperatorOAuth só no thinkzap', () => {
    const withOAuth = listAppCatalog().filter(e => e.requiresOperatorOAuth)
    expect(withOAuth.map(e => e.appCode)).toEqual(['crmthink.thinkzap'])
  })
})

describe('resolveByAppCode', () => {
  it('resolve pelo code canônico', () => {
    expect(resolveByAppCode('crmthink.importsheet')?.slug).toBe('importsheet')
  })

  it('não resolve pelo code do marketplace', () => {
    expect(resolveByAppCode('local.marketplace.importsheet')).toBeNull()
  })

  it('devolve null para code ausente', () => {
    expect(resolveByAppCode(undefined)).toBeNull()
  })
})

describe('env de code do marketplace vazia', () => {
  it('não registra entrada de chave vazia', async () => {
    vi.resetModules()
    vi.doMock('@/config/env', () => ({
      env: {
        appCodes: {
          thinkzap: '',
          thinkanalise: '',
          importsheet: '',
          clicksign: '',
        },
      },
    }))

    const catalog = await import('./app-catalog')

    expect(catalog.resolveByMarketplaceCode('')).toBeNull()
    // O canônico continua resolvendo — só a chave vazia é descartada.
    expect(catalog.resolveByMarketplaceCode('crmthink.thinkzap')?.slug).toBe(
      'thinkzap',
    )
  })
})

describe('thinkzapAppCodeId', () => {
  /**
   * A armadilha que custou duas regressões: `env.appCodes.thinkzap` é o code do
   * **marketplace** (em instalação local, algo como
   * `local.6a070b9ee9dfb9.18692076`), enquanto `core_app_codes.id` guarda o
   * canônico. Passar um no lugar do outro compila e falha só em runtime, com
   * "Aplicação não encontrada".
   */
  it('devolve o code canônico, não o do marketplace', () => {
    expect(thinkzapAppCodeId()).toBe('crmthink.thinkzap')
    expect(thinkzapAppCodeId()).not.toBe('local.marketplace.thinkzap')
  })
})
