import {
  TemplateDefaultsRepository,
  TemplateKey,
  templateKeyOf,
} from '@/modules/thinkzap/domain/ports/template-defaults-repository.port'
import { ResolveTemplateContextInput } from './resolve-template-context'

/**
 * Imagens padrão da linha, para juntar com a lista ao vivo da Meta.
 *
 * Devolve uma busca por template (nome + idioma). Sem repository (consumidor que
 * não precisa delas, ou teste antigo) a busca nunca acha nada.
 */
export async function loadDefaultImages(
  repository: TemplateDefaultsRepository | null,
  input: ResolveTemplateContextInput,
): Promise<(template: TemplateKey) => string | undefined> {
  if (!repository) return () => undefined

  const defaults = await repository.findMany({
    domainId: input.domainId,
    subscriptionItemId: input.subscriptionItemId,
  })
  const byKey = new Map(
    defaults.map(d => [templateKeyOf(d), d.headerImageUrl] as const),
  )
  return template => byKey.get(templateKeyOf(template))
}
