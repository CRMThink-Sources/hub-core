import { describe, expect, it } from 'vitest'
import { TemplatesNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import { ZApiTemplateProvider } from './zapi-template-provider'

describe('ZApiTemplateProvider', () => {
  const provider = new ZApiTemplateProvider()

  it('supportsTemplates é false', () => {
    expect(provider.supportsTemplates).toBe(false)
  })

  it('listTemplates lança TemplatesNotSupportedError', () => {
    expect(() => provider.listTemplates()).toThrow(TemplatesNotSupportedError)
  })

  it('createTemplate lança TemplatesNotSupportedError', () => {
    expect(() =>
      provider.createTemplate({
        wabaId: 'w',
        name: 'x',
        category: 'UTILITY',
        language: 'pt_BR',
        components: [],
      }),
    ).toThrow(TemplatesNotSupportedError)
  })

  it('syncTemplates lança TemplatesNotSupportedError', () => {
    expect(() => provider.syncTemplates()).toThrow(TemplatesNotSupportedError)
  })
})
