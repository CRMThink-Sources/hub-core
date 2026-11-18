import type { VariableMappings } from '@/modules/thinkzap/domain/template-variable-mapping'
import type {
  TemplateDefaultsScope,
  TemplateKey,
} from './template-defaults-repository.port'

/**
 * Variáveis padrão do envio de um template, por tipo de entidade.
 *
 * Mesma chave da imagem padrão (linha + nome + idioma — o que não muda numa edição
 * do template), mais o `entityTypeId`: Negócio e Contato não têm os mesmos campos.
 */
export interface TemplateVariableMappingsRepository {
  find(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
    entityTypeId: number,
  ): Promise<VariableMappings | null>

  /** Cria ou substitui o mapeamento do template para o tipo de entidade. */
  upsert(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
    entityTypeId: number,
    mappings: VariableMappings,
  ): Promise<void>

  /** Remove o mapeamento. Sem registro, não faz nada. */
  delete(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
    entityTypeId: number,
  ): Promise<void>
}
