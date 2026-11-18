import { describe, expect, it, vi } from 'vitest'
import { Request } from 'express'
import { ZodError } from 'zod'
import type { GetTemplateVariableMappingUseCase } from '@/modules/thinkzap/application/get-template-variable-mapping'
import type { ListCrmFieldsUseCase } from '@/modules/thinkzap/application/list-crm-fields'
import type { ResolveTemplateVariableValuesUseCase } from '@/modules/thinkzap/application/resolve-template-variable-values'
import type { SetTemplateVariableMappingUseCase } from '@/modules/thinkzap/application/set-template-variable-mapping'
import { InvalidTemplateError } from '@/modules/thinkzap/application/helpers/template-definition'
import { TemplateNotFoundError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateVariableValuesController } from '../template-variable-values.controller'
import { ListCrmFieldsController } from './list-crm-fields.controller'
import {
  GetTemplateVariableMappingController,
  SetTemplateVariableMappingController,
} from './template-variable-mapping.controller'

const auth = { domainId: 'domain_1', appId: 'crmthink.thinkzap' }

function req(extra: Record<string, unknown>): Request {
  return { ...auth, ...extra } as unknown as Request
}

const lineParams = { itemId: 'item_1', name: 'pedido', language: 'pt_BR' }

describe('SetTemplateVariableMappingController', () => {
  const body = {
    entityTypeId: 2,
    mappings: { '1': { source: 'contact', fieldId: 'name' } },
  }

  it('200 com o mapeamento guardado', async () => {
    const execute = vi.fn().mockResolvedValue({ mappings: body.mappings })
    const controller = new SetTemplateVariableMappingController({
      execute,
    } as unknown as SetTemplateVariableMappingUseCase)

    const res = await controller.perform(req({ params: lineParams, body }))

    expect(res.status).toBe(200)
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionItemId: 'item_1',
        domainId: 'domain_1',
        name: 'pedido',
        language: 'pt_BR',
        entityTypeId: 2,
        mappings: body.mappings,
      }),
    )
  })

  it('400 quando o use case recusa a definição', async () => {
    const controller = new SetTemplateVariableMappingController({
      execute: vi.fn().mockRejectedValue(new InvalidTemplateError('sem {{9}}')),
    } as unknown as SetTemplateVariableMappingUseCase)

    const res = await controller.perform(req({ params: lineParams, body }))

    expect(res.status).toBe(400)
    expect(res.result).toEqual({ error: 'sem {{9}}' })
  })

  it('404 para template que não existe na linha', async () => {
    const controller = new SetTemplateVariableMappingController({
      execute: vi.fn().mockRejectedValue(new TemplateNotFoundError('x')),
    } as unknown as SetTemplateVariableMappingUseCase)

    const res = await controller.perform(req({ params: lineParams, body }))

    expect(res.status).toBe(404)
  })

  it('rejeita origem desconhecida na validação do pedido', async () => {
    const execute = vi.fn()
    const controller = new SetTemplateVariableMappingController({
      execute,
    } as unknown as SetTemplateVariableMappingUseCase)

    await expect(
      controller.perform(
        req({
          params: lineParams,
          body: {
            entityTypeId: 2,
            mappings: { '1': { source: 'owner', fieldId: 'name' } },
          },
        }),
      ),
    ).rejects.toThrow(ZodError)
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('GetTemplateVariableMappingController', () => {
  it('200 com o mapeamento do tipo pedido', async () => {
    const execute = vi.fn().mockResolvedValue({ mappings: {} })
    const controller = new GetTemplateVariableMappingController({
      execute,
    } as unknown as GetTemplateVariableMappingUseCase)

    const res = await controller.perform(
      req({ params: lineParams, query: { entityTypeId: '3' } }),
    )

    expect(res.status).toBe(200)
    expect(res.result).toEqual({ mappings: {} })
    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain_1',
      subscriptionItemId: 'item_1',
      name: 'pedido',
      language: 'pt_BR',
      entityTypeId: 3,
    })
  })
})

describe('ListCrmFieldsController', () => {
  it('200 com os campos', async () => {
    const execute = vi.fn().mockResolvedValue([{ id: 'title' }])
    const controller = new ListCrmFieldsController({
      execute,
    } as unknown as ListCrmFieldsUseCase)

    const res = await controller.perform(req({ query: { entityTypeId: '2' } }))

    expect(res.result).toEqual({ fields: [{ id: 'title' }] })
    expect(execute).toHaveBeenCalledWith({ entityTypeId: 2 })
  })
})

describe('TemplateVariableValuesController', () => {
  const params = {
    subscriptionItemId: 'item_1',
    name: 'pedido',
    language: 'pt_BR',
  }

  it('traduz o tipo do widget e devolve os valores', async () => {
    const execute = vi.fn().mockResolvedValue({ values: { '1': 'Maria' } })
    const controller = new TemplateVariableValuesController({
      execute,
    } as unknown as ResolveTemplateVariableValuesUseCase)

    const res = await controller.perform(
      req({ params, query: { entity: 'DYNAMIC_1060', entityId: '1613' } }),
    )

    expect(res.status).toBe(200)
    expect(res.result).toEqual({ values: { '1': 'Maria' } })
    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain_1',
      subscriptionItemId: 'item_1',
      name: 'pedido',
      language: 'pt_BR',
      entityTypeId: 1060,
      entityId: '1613',
    })
  })

  it('400 para tipo de entidade desconhecido, sem ler o CRM', async () => {
    const execute = vi.fn()
    const controller = new TemplateVariableValuesController({
      execute,
    } as unknown as ResolveTemplateVariableValuesUseCase)

    const res = await controller.perform(
      req({ params, query: { entity: 'quote', entityId: '1' } }),
    )

    expect(res.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })
})
