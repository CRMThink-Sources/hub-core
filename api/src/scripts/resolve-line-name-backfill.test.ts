import { describe, expect, it } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { isGeneratedLineName } from '@/modules/thinkzap/application/helpers/line-resource-metadata'
import {
  resolveLineNameBackfill,
  stripDomainPrefix,
} from './resolve-line-name-backfill'

const item = (patch: Partial<Parameters<typeof resolveLineNameBackfill>[0]>) =>
  resolveLineNameBackfill({
    itemId: 'i1',
    provider: ConnectorProvider.ZAPI,
    currentName: 'WhatsApp',
    remoteName: 'acme.bitrix24.com.br | Comercial',
    ...patch,
  })

describe('isGeneratedLineName', () => {
  it.each(['WhatsApp', 'WhatsApp 2', 'WhatsApp 17', 'WhatsApp (teste)'])(
    'reconhece %s como nome gerado da Z-API',
    name => {
      expect(isGeneratedLineName(name, ConnectorProvider.ZAPI)).toBe(true)
    },
  )

  it.each([
    'WhatsApp Oficial',
    'WhatsApp Oficial 3',
    'WhatsApp Oficial (teste)',
  ])('reconhece %s como nome gerado da HubMessage', name => {
    expect(isGeneratedLineName(name, ConnectorProvider.HUBMESSAGE)).toBe(true)
  })

  it.each(['Comercial', 'WhatsApp Vendas', 'Suporte 2', 'WhatsApp Oficial'])(
    'não reconhece %s como gerado para a Z-API',
    name => {
      expect(isGeneratedLineName(name, ConnectorProvider.ZAPI)).toBe(false)
    },
  )

  it('ignora espaços em volta', () => {
    expect(isGeneratedLineName('  WhatsApp 2  ', ConnectorProvider.ZAPI)).toBe(
      true,
    )
  })
})

describe('stripDomainPrefix', () => {
  it('tira o prefixo do domínio', () => {
    expect(stripDomainPrefix('acme.bitrix24.com.br | Comercial')).toBe(
      'Comercial',
    )
  })

  it('devolve o nome inteiro quando não há prefixo', () => {
    expect(stripDomainPrefix('Comercial')).toBe('Comercial')
  })

  it('corta só no primeiro separador', () => {
    expect(stripDomainPrefix('acme | Comercial | SP')).toBe('Comercial | SP')
  })
})

describe('resolveLineNameBackfill', () => {
  it('escreve o nome da Z-API quando o título ainda é o gerado', () => {
    expect(item({})).toEqual({ kind: 'write', itemId: 'i1', name: 'Comercial' })
  })

  it('escreve também quando o título gerado tem sufixo de ordem', () => {
    expect(item({ currentName: 'WhatsApp 3' })).toEqual({
      kind: 'write',
      itemId: 'i1',
      name: 'Comercial',
    })
  })

  it('preserva o título já ajustado', () => {
    expect(item({ currentName: 'Suporte' })).toEqual({
      kind: 'skipped',
      itemId: 'i1',
      reason: 'nome-ja-ajustado',
    })
  })

  it('não escreve quando o nome remoto, sem prefixo, é igual ao atual', () => {
    expect(
      item({
        currentName: 'WhatsApp',
        remoteName: 'acme.bitrix24.com.br | WhatsApp',
      }),
    ).toEqual({ kind: 'skipped', itemId: 'i1', reason: 'ja-igual' })
  })

  it('não escreve quando a Z-API não tem nome', () => {
    expect(item({ remoteName: undefined })).toEqual({
      kind: 'skipped',
      itemId: 'i1',
      reason: 'sem-nome-remoto',
    })
  })

  it('não escreve quando a Z-API tem só o prefixo', () => {
    expect(item({ remoteName: 'acme.bitrix24.com.br | ' })).toEqual({
      kind: 'skipped',
      itemId: 'i1',
      reason: 'sem-nome-remoto',
    })
  })

  it('ignora linha oficial', () => {
    expect(
      item({
        provider: ConnectorProvider.HUBMESSAGE,
        currentName: 'WhatsApp Oficial',
      }),
    ).toEqual({ kind: 'skipped', itemId: 'i1', reason: 'outro-provider' })
  })

  it('ignora item de cobrança sem conector', () => {
    expect(item({ provider: 'NONE' })).toEqual({
      kind: 'skipped',
      itemId: 'i1',
      reason: 'outro-provider',
    })
  })
})
