/**
 * Grava o nome de exibição de um usuário permitido **que já existe**.
 *
 * Não cria row: a existência da row é o que concede acesso ao app. Um upsert aqui
 * transformaria "entrar para atualizar o nome" em "entrar para ganhar permissão".
 */
export interface UpdateAllowedUserDisplayNameRepository {
  /** @returns quantas rows foram atualizadas — `0` = usuário não é permitido. */
  updateDisplayName(
    appId: string,
    bitrixUserId: string,
    displayName: string,
  ): Promise<number>
}
