/**
 * Template declarado que não está no catálogo aprovado daquela linha.
 *
 * Recusa no **registro** do provedor, não só no envio: um sender apontando para
 * template inexistente apareceria na campanha do cliente e mataria todo destinatário
 * no momento do envio — que é a falha mais cara possível, porque a mensagem do
 * WhatsApp Oficial é cobrada e a campanha já está em curso quando ela aparece.
 */
export class TemplateNotInCatalogError extends Error {
  constructor(
    readonly templateName: string,
    readonly language: string,
  ) {
    super(
      `O template "${templateName}" (${language}) não está no catálogo aprovado desta linha`,
    )
    this.name = 'TemplateNotInCatalogError'
  }
}
