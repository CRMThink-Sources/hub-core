/**
 * Já existe outro grupo de acesso com este nome na instalação.
 *
 * O nome é a única forma de o administrador distinguir os grupos na tela; dois
 * iguais (mesmo variando maiúsculas) deixariam a lista ambígua.
 */
export class AccessGroupNameTakenError extends Error {
  constructor(readonly groupName: string) {
    super(
      `Já existe um grupo de acesso chamado "${groupName}". Use outro nome para o grupo.`,
    )
    this.name = 'AccessGroupNameTakenError'
  }
}
