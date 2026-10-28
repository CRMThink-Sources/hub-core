/**
 * Imagem padrão do envio de um template com cabeçalho de imagem.
 *
 * A Meta não guarda imagem fixa para o envio: a do cadastro é só a amostra da
 * aprovação. Sem isto, o operador teria de informar a imagem a cada envio.
 *
 * Chave por linha + nome + idioma — o que o catálogo de envio, a fila e o robô
 * conhecem do template, e o que não muda numa edição.
 */

export type TemplateDefaultsScope = {
  domainId: string
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
}

export type TemplateKey = {
  name: string
  language: string
}

export type TemplateDefaults = TemplateKey & {
  /** URL pública `https`, sem expiração. */
  headerImageUrl: string
}

export interface TemplateDefaultsRepository {
  find(
    scope: TemplateDefaultsScope,
    key: TemplateKey,
  ): Promise<TemplateDefaults | null>

  /** Todas as imagens padrão da linha, para juntar com a lista ao vivo da Meta. */
  findMany(scope: TemplateDefaultsScope): Promise<TemplateDefaults[]>

  /** Cria ou substitui a imagem padrão do template. */
  upsert(
    scope: TemplateDefaultsScope,
    defaults: TemplateDefaults,
  ): Promise<void>
}

/** Chave de mapa para casar um template da lista com a imagem padrão dele. */
export function templateKeyOf(key: TemplateKey): string {
  return `${key.name}\u0000${key.language}`
}
