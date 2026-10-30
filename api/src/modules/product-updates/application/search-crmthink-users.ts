import type {
  CrmthinkTasksGateway,
  CrmthinkUser,
} from '../domain/ports/crmthink-tasks-gateway.port'

/** Abaixo disso a busca devolveria o portal inteiro. */
const MIN_TERM_LENGTH = 2

/**
 * Busca de responsável para criar a tarefa: usuários ativos do portal da CRMThink por
 * nome ou e-mail. Termo com menos de 2 caracteres é lista vazia, sem chamar o Bitrix.
 */
export class SearchCrmthinkUsers {
  constructor(private readonly gateway: CrmthinkTasksGateway) {}

  async execute(term: string): Promise<CrmthinkUser[]> {
    const query = term.trim()
    if (query.length < MIN_TERM_LENGTH) return []
    return this.gateway.searchUsers(query)
  }
}
