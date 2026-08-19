import { describe, expect, it, vi } from 'vitest'
import { resolveRobotTemplateBody } from './resolve-robot-template-body'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const input = {
  name: 'order_update',
  language: 'pt_BR',
  subscriptionItemId: 'item_1',
  domainId: 'domain_1',
  appCode: 'crmthink.thinkzap',
  configuredBody: '',
}

const catalog = [
  { name: 'order_update', language: 'pt_BR', body: 'Olá {{1}}, pedido {{2}}.' },
  { name: 'order_update', language: 'en_US', body: 'Hi {{1}}, order {{2}}.' },
]

describe('resolveRobotTemplateBody', () => {
  it('usa o corpo da configuração sem consultar o catálogo', async () => {
    const lookup = vi.fn()

    const body = await resolveRobotTemplateBody(
      { ...input, configuredBody: 'Olá {{1}}, tudo certo.' },
      lookup,
    )

    expect(body).toBe('Olá {{1}}, tudo certo.')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('busca por nome e idioma quando a configuração não tem corpo', async () => {
    const lookup = vi.fn().mockResolvedValue(catalog)

    const body = await resolveRobotTemplateBody(input, lookup)

    expect(body).toBe('Olá {{1}}, pedido {{2}}.')
    expect(lookup).toHaveBeenCalledWith({
      subscriptionItemId: 'item_1',
      domainId: 'domain_1',
      appCode: 'crmthink.thinkzap',
    })
  })

  // Mesmo nome em dois idiomas é o caso comum de WABA: o par é que identifica.
  it('não confunde idiomas do mesmo template', async () => {
    const lookup = vi.fn().mockResolvedValue(catalog)

    const body = await resolveRobotTemplateBody(
      { ...input, language: 'en_US' },
      lookup,
    )

    expect(body).toBe('Hi {{1}}, order {{2}}.')
  })

  it('cai no nome do template quando o catálogo não tem o par', async () => {
    const lookup = vi.fn().mockResolvedValue([])

    expect(await resolveRobotTemplateBody(input, lookup)).toBe('order_update')
  })

  // O provider recebe o par (template, parâmetros): sem corpo o envio ainda funciona,
  // só o registro fica pobre.
  it('cai no nome do template quando o catálogo falha', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('provider indisponível'))

    expect(await resolveRobotTemplateBody(input, lookup)).toBe('order_update')
  })

  it('trata corpo em branco como ausente', async () => {
    const lookup = vi.fn().mockResolvedValue(catalog)

    const body = await resolveRobotTemplateBody(
      { ...input, configuredBody: '   ' },
      lookup,
    )

    expect(body).toBe('Olá {{1}}, pedido {{2}}.')
  })
})
