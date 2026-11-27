import { describe, expect, it } from 'vitest'
import { THINKZAP_ASIDE_CONFIG } from './thinkzap-aside-config'
import { filterThinkzapAsideLinks } from './thinkzap-aside-links'

const hrefs = (input: Parameters<typeof filterThinkzapAsideLinks>[1]) =>
  filterThinkzapAsideLinks(THINKZAP_ASIDE_CONFIG.links, input).map(l => l.href)

describe('filterThinkzapAsideLinks', () => {
  it('a config tem o item envios', () => {
    expect(THINKZAP_ASIDE_CONFIG.links).toContainEqual({
      href: '/thinkzap/envios',
      label: 'envios',
    })
  })

  it('usuário sem papel de administrador com canAccess vê Envios e não vê Administração', () => {
    const result = hrefs({
      canManageAccess: false,
      thinkzapAccess: { canAccess: true },
      thinkbotMenuEnabled: true,
    })
    expect(result).toContain('/thinkzap/envios')
    expect(result).not.toContain('/thinkzap/administracao')
  })

  it('sem canAccess o item some junto com home, conexões e insights', () => {
    const result = hrefs({
      canManageAccess: false,
      thinkzapAccess: { canAccess: false },
      thinkbotMenuEnabled: true,
    })
    expect(result).not.toContain('/thinkzap/envios')
    expect(result).not.toContain('/thinkzap/insights')
  })

  it('administrador também vê Envios', () => {
    expect(
      hrefs({
        canManageAccess: true,
        thinkzapAccess: { canAccess: true },
        thinkbotMenuEnabled: false,
      }),
    ).toContain('/thinkzap/envios')
  })
})
