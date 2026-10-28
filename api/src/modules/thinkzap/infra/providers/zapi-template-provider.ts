import { TemplatesNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import {
  CreateTemplateInput,
  CreatedTemplate,
  Template,
  UpdateTemplateInput,
  WhatsAppTemplateProvider,
} from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'

/**
 * Z-API (WhatsApp não oficial) ainda não expõe templates da Meta. Implementa o
 * contrato como *unsupported*: qualquer operação lança `TemplatesNotSupportedError`.
 * Substituível quando o não oficial da HubMessage entrar (roadmap).
 */
export class ZApiTemplateProvider implements WhatsAppTemplateProvider {
  readonly supportsTemplates = false

  listTemplates(): Promise<Template[]> {
    throw new TemplatesNotSupportedError('ZAPI')
  }

  createTemplate(_input: CreateTemplateInput): Promise<CreatedTemplate> {
    throw new TemplatesNotSupportedError('ZAPI')
  }

  updateTemplate(_input: UpdateTemplateInput): Promise<void> {
    throw new TemplatesNotSupportedError('ZAPI')
  }

  syncTemplates(): Promise<Template[]> {
    throw new TemplatesNotSupportedError('ZAPI')
  }
}
