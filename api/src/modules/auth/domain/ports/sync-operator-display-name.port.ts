/**
 * Registra, na instalação, o nome de exibição do operador que acabou de entrar.
 *
 * Existe como porta porque o login é compartilhado por todos os apps e o
 * destino do nome é de um app só. Quem entrega a implementação é a camada
 * `main`; o controller não conhece o app de destino.
 *
 * **Por que no login:** é o único momento em que o nome vem do token do próprio
 * usuário (`user.current`), que não depende do escopo concedido ao app. No envio
 * de mensagem quem chama o Bitrix é o worker, com o token do app — se aquele
 * escopo faltar, o nome só pode vir do que o login gravou.
 */
export interface SyncOperatorDisplayNamePort {
  sync(input: {
    /** `core_app_codes.id` do app que está autenticando. */
    appCodeId: string
    /** Uuid de `core_domains`. */
    domainId: string
    bitrixUserId: string
    displayName: string
  }): Promise<void>
}
