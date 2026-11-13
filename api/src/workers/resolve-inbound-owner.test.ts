import { describe, expect, it, vi } from 'vitest'
import { makeResolveInboundOwner } from './resolve-inbound-owner'

function makeDeps() {
  return {
    getDomainByName: vi.fn(),
    getDomainById: vi.fn(),
    getInstanceByZApiInstanceId: vi.fn(),
    getInstanceByChannelId: vi.fn(),
  }
}

describe('makeResolveInboundOwner', () => {
  it('Bitrix: resolve o portal pelo nome', async () => {
    const deps = makeDeps()
    deps.getDomainByName.mockResolvedValue({
      id: 'domain-1',
      name: 'acme.bitrix24.com',
    })

    const owner = await makeResolveInboundOwner(deps)({
      domainName: 'acme.bitrix24.com',
    })

    expect(owner).toEqual({
      domainId: 'domain-1',
      domainName: 'acme.bitrix24.com',
    })
  })

  it('Bitrix com portal desconhecido: mantém o nome para a lista mostrar', async () => {
    const deps = makeDeps()
    deps.getDomainByName.mockResolvedValue(null)

    const owner = await makeResolveInboundOwner(deps)({
      domainName: 'fantasma.bitrix24.com',
    })

    expect(owner).toEqual({ domainName: 'fantasma.bitrix24.com' })
  })

  it('Z-API: instância pelo id da Z-API, depois o portal da instância', async () => {
    const deps = makeDeps()
    deps.getInstanceByZApiInstanceId.mockResolvedValue({
      id: 'inst-1',
      domainId: 'domain-1',
    })
    deps.getDomainById.mockResolvedValue({
      id: 'domain-1',
      name: 'acme.bitrix24.com',
    })

    const owner = await makeResolveInboundOwner(deps)({
      zApiInstanceId: 'ZAPI-1',
    })

    expect(deps.getInstanceByZApiInstanceId).toHaveBeenCalledWith('ZAPI-1')
    expect(owner).toEqual({
      instanceId: 'inst-1',
      domainId: 'domain-1',
      domainName: 'acme.bitrix24.com',
    })
  })

  it('HubMessage: instância pelo canal', async () => {
    const deps = makeDeps()
    deps.getInstanceByChannelId.mockResolvedValue({
      id: 'inst-2',
      domainId: 'domain-2',
    })
    deps.getDomainById.mockResolvedValue(null)

    const owner = await makeResolveInboundOwner(deps)({ channelId: 'C-9' })

    expect(deps.getInstanceByChannelId).toHaveBeenCalledWith('C-9')
    expect(owner).toEqual({ instanceId: 'inst-2', domainId: 'domain-2' })
  })

  it('instância desconhecida: devolve vazio', async () => {
    const deps = makeDeps()
    deps.getInstanceByChannelId.mockResolvedValue(null)

    await expect(
      makeResolveInboundOwner(deps)({ channelId: 'C-0' }),
    ).resolves.toEqual({})
  })

  it('sem nada que identifique o portal: não consulta e devolve vazio', async () => {
    const deps = makeDeps()

    await expect(makeResolveInboundOwner(deps)({})).resolves.toEqual({})
    expect(deps.getDomainByName).not.toHaveBeenCalled()
    expect(deps.getInstanceByChannelId).not.toHaveBeenCalled()
  })

  it('erro de banco no lookup devolve vazio, sem lançar', async () => {
    const deps = makeDeps()
    deps.getInstanceByZApiInstanceId.mockRejectedValue(new Error('banco fora'))

    await expect(
      makeResolveInboundOwner(deps)({ zApiInstanceId: 'ZAPI-1' }),
    ).resolves.toEqual({})
  })
})
