import { describe, expect, it } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplatesNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { MapTemplateProviderResolver } from './map-template-provider-resolver'

const stub = {
  supportsTemplates: true,
} as unknown as WhatsAppTemplateProvider

describe('MapTemplateProviderResolver', () => {
  it('resolve o adapter registrado', () => {
    const resolver = new MapTemplateProviderResolver({
      [ConnectorProvider.HUBMESSAGE]: stub,
    })
    expect(resolver.resolve(ConnectorProvider.HUBMESSAGE)).toBe(stub)
  })

  it('lança TemplatesNotSupportedError quando provider não registrado', () => {
    const resolver = new MapTemplateProviderResolver({})
    expect(() => resolver.resolve(ConnectorProvider.ZAPI)).toThrow(
      TemplatesNotSupportedError,
    )
  })
})
