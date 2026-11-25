/**
 * A estrutura de departamentos do portal não pôde ser consultada e não há nenhuma
 * conhecida.
 *
 * Erro próprio, e não "linha não permitida": o usuário pode ter acesso por um
 * departamento superior, e mandá-lo pedir permissão ao administrador seria mentira.
 */
export class DepartmentsUnavailableError extends Error {
  constructor() {
    super(
      'Não foi possível verificar os departamentos no Bitrix24 agora. Tente novamente em instantes; se persistir, peça ao administrador para conferir a permissão "department" do aplicativo.',
    )
    this.name = 'DepartmentsUnavailableError'
  }
}
