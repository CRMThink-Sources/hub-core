import { describe, expect, it, vi } from 'vitest'

import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  PLAN_GATEWAY_ID_FIELDS,
  PlanGatewayIdFieldIsEnumerationError,
  PlanGatewayIdFieldMissingError,
  ensurePlanGatewayIdFields,
  planGatewayIdField,
} from './ensure-plan-gateway-id-fields'

const bitrixWithFields = (fields: Record<string, { type?: string }>) =>
  ({
    getCrmItemFields: vi.fn().mockResolvedValue({ result: { fields } }),
  }) as unknown as BitrixClient

const bothFieldsAsText = {
  [PLAN_GATEWAY_ID_FIELDS.production]: { type: 'string' },
  [PLAN_GATEWAY_ID_FIELDS.homolog]: { type: 'string' },
}

describe('planGatewayIdField', () => {
  it('resolve o campo do ambiente pedido', () => {
    expect(planGatewayIdField('production')).toBe('ufCrm89GatewayId')
    expect(planGatewayIdField('homolog')).toBe('ufCrm89GatewayIdHomolog')
  })
})

describe('ensurePlanGatewayIdFields', () => {
  it('passa quando os dois campos existem como texto', async () => {
    await expect(
      ensurePlanGatewayIdFields(bitrixWithFields(bothFieldsAsText), 1138),
    ).resolves.toBeUndefined()
  })

  /**
   * O catálogo é só leitura em todos os caminhos: a verificação nem cria campo nem
   * grava plano. O duplo abaixo só tem `getCrmItemFields`, então qualquer chamada de
   * escrita seria `TypeError` — e o teste falha por si, sem precisar listar métodos
   * que o cliente poderia ganhar depois.
   */
  it('não escreve nada no CRM', async () => {
    const getCrmItemFields = vi
      .fn()
      .mockResolvedValue({ result: { fields: bothFieldsAsText } })

    await ensurePlanGatewayIdFields(
      { getCrmItemFields } as unknown as BitrixClient,
      1138,
    )

    expect(getCrmItemFields).toHaveBeenCalledTimes(2)
    expect(getCrmItemFields).toHaveBeenCalledWith(1138)
  })

  it('falha alto quando o campo de produção não existe', async () => {
    await expect(
      ensurePlanGatewayIdFields(
        bitrixWithFields({
          [PLAN_GATEWAY_ID_FIELDS.homolog]: { type: 'string' },
        }),
        1138,
      ),
    ).rejects.toBeInstanceOf(PlanGatewayIdFieldMissingError)
  })

  /**
   * O campo de homologação é criado à mão no portal, e o modo mais provável de errar
   * é o sufixo do `FIELD_NAME`. A mensagem tem que nomear o campo de leitura, o
   * `FIELD_NAME` a criar e o ambiente — sem isso o sintoma na tela ("nenhum plano
   * disponível") não aponta para o CRM.
   */
  it('falha nomeando campo, FIELD_NAME e ambiente quando o de homologação não existe', async () => {
    const promise = ensurePlanGatewayIdFields(
      bitrixWithFields({
        [PLAN_GATEWAY_ID_FIELDS.production]: { type: 'string' },
        ufCrm89GatewayIdHomol: { type: 'string' },
      }),
      1138,
    )

    await expect(promise).rejects.toBeInstanceOf(PlanGatewayIdFieldMissingError)
    await expect(promise).rejects.toThrow(PLAN_GATEWAY_ID_FIELDS.homolog)
    await expect(promise).rejects.toThrow('UF_CRM_89_GATEWAY_ID_HOMOLOG')
    await expect(promise).rejects.toThrow('homolog')
  })

  /**
   * Campo de lista devolve o id de enum gerado pelo portal, não o valor — o price id
   * nunca chegaria ao `line_item`, e o gateway recusaria a sessão longe daqui.
   */
  it('falha quando um dos campos é de lista', async () => {
    await expect(
      ensurePlanGatewayIdFields(
        bitrixWithFields({
          [PLAN_GATEWAY_ID_FIELDS.production]: { type: 'string' },
          [PLAN_GATEWAY_ID_FIELDS.homolog]: { type: 'enumeration' },
        }),
        1138,
      ),
    ).rejects.toBeInstanceOf(PlanGatewayIdFieldIsEnumerationError)
  })

  it('trata resposta sem fields como campo ausente', async () => {
    const bitrix = {
      getCrmItemFields: vi.fn().mockResolvedValue({}),
    } as unknown as BitrixClient

    await expect(
      ensurePlanGatewayIdFields(bitrix, 1138),
    ).rejects.toBeInstanceOf(PlanGatewayIdFieldMissingError)
  })
})
