/** O grupo de acesso não existe nesta instalação (já foi excluído ou o id é de outra). */
export class AccessGroupNotFoundError extends Error {
  constructor(readonly groupId: string) {
    super(
      'Grupo de acesso não encontrado. Atualize a lista de grupos e tente de novo.',
    )
    this.name = 'AccessGroupNotFoundError'
  }
}
