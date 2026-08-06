/**
 * Code de marketplace que o catálogo de apps não reconhece.
 *
 * Erro nomeado de propósito: antes o login respondia `App ID not found`, que o
 * front não conseguia distinguir de "instalação não existe". O cliente precisa
 * saber que a app não está configurada na plataforma, não que o portal dele
 * está sem instalação.
 */
export class UnknownAppError extends Error {
  constructor(marketplaceCode: string) {
    super(`Aplicação não reconhecida: "${marketplaceCode}"`)
    this.name = 'UnknownAppError'
  }
}
