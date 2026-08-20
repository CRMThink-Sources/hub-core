/**
 * Contato comercial de uma instalação, nos campos do item de cliente da SPA 1060.
 *
 * Recorte próprio e não `Pick<Spa, ...>`: `Spa` é o espelho inteiro do item
 * (vínculo, member id, status, campos de trial), e quem lê ou escreve contato não
 * tem nada a ver com o resto. O tipo separado é o que permite ler e gravar contato
 * por id do item, sem carregar a chave `(appId, domain)` que `Spa` exige.
 *
 * Todo campo é `string` e nunca `null`: campo vazio no CRM é `''`, e é a tela que
 * decide o que fazer com "ainda não preenchido".
 */
export interface SpaClientContact {
  name: string
  email: string
  phone: string
  company: string
}
