import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import { ListButtonLinesUseCase } from '@/modules/thinkzap/application/list-button-lines'
import { ButtonLinesController } from './button-lines.controller'

function build(lines: { id: string; name: string }[] = []) {
  const execute = vi.fn().mockResolvedValue(lines)
  const controller = new ButtonLinesController({
    execute,
  } as unknown as ListButtonLinesUseCase)

  return { controller, execute }
}

function request(overrides: Partial<Request> = {}): Request {
  return {
    domainId: 'domain_1',
    appId: 'crmthink.thinkzap',
    params: {},
    ...overrides,
  } as unknown as Request
}

describe('ButtonLinesController', () => {
  it('devolve as linhas elegíveis da instalação do token', async () => {
    const { controller, execute } = build([{ id: 'item_1', name: 'Oficial' }])

    const response = await controller.perform(request())

    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain_1',
      appCode: 'crmthink.thinkzap',
    })
    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      lines: [{ id: 'item_1', name: 'Oficial' }],
    })
  })

  it('recusa quando o token não carrega a instalação', async () => {
    const { controller, execute } = build()

    const response = await controller.perform(
      request({ domainId: undefined, appId: undefined } as Partial<Request>),
    )

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('devolve lista vazia quando a instalação não tem linha elegível', async () => {
    const { controller } = build([])

    const response = await controller.perform(request())

    expect(response.result).toEqual({ lines: [] })
  })
})
