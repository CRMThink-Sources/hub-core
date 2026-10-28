import { describe, expect, it } from 'vitest'
import { ADMIN_NAV_GROUPS, isAdminNavActive } from './admin-nav'

const home = { href: '/admin', exact: true }
const jobs = { href: '/admin/jobs', exact: false }

describe('isAdminNavActive', () => {
  it('Início só fica ativo na própria rota', () => {
    expect(isAdminNavActive('/admin', home)).toBe(true)
    expect(isAdminNavActive('/admin/clientes', home)).toBe(false)
  })

  it('os demais itens ficam ativos também nas sub-rotas', () => {
    expect(isAdminNavActive('/admin/jobs', jobs)).toBe(true)
    expect(isAdminNavActive('/admin/jobs/expiracao-assinaturas', jobs)).toBe(
      true,
    )
  })

  it('não confunde prefixo de rota com sub-rota', () => {
    expect(
      isAdminNavActive('/admin/usuarios-mcp', {
        href: '/admin/usuarios',
        exact: false,
      }),
    ).toBe(false)
  })
})

describe('ADMIN_NAV_GROUPS', () => {
  it('põe Jobs e Falhas de envio sob o grupo Operação', () => {
    const operations = ADMIN_NAV_GROUPS.find(
      group => group.labelKey === 'navGroupOperations',
    )
    expect(operations?.items.map(item => item.href)).toEqual([
      '/admin/jobs',
      '/admin/falhas-envio',
    ])
  })
})
