import type { AccessGroup, AccessGroupInput } from '../../entities/access-group'

/** Por onde um usuário pode pertencer a um grupo. */
export type AccessGroupMembership = {
  bitrixUserId: string
  /** Lotação direta. */
  departmentIds: string[]
  /** Departamentos acima da lotação; só contam em vínculo com subdepartamentos. */
  ancestorDepartmentIds: string[]
}

export interface AccessGroupRepository {
  list(appId: string): Promise<AccessGroup[]>

  /** Há ao menos um grupo na instalação? Sem nenhum, ninguém é restringido. */
  hasAny(appId: string): Promise<boolean>

  /** Algum grupo da instalação inclui subdepartamentos? */
  hasInheritingDepartments(appId: string): Promise<boolean>

  /** Linhas liberadas ao usuário: união das linhas de todos os grupos dele. */
  listLineIdsForUser(
    appId: string,
    membership: AccessGroupMembership,
  ): Promise<string[]>

  /** @throws AccessGroupNameTakenError quando outro grupo já usa o nome. */
  create(appId: string, input: AccessGroupInput): Promise<AccessGroup>

  /**
   * Substitui nome, membros e linhas do grupo; os departamentos só quando
   * informados.
   * @throws AccessGroupNameTakenError quando outro grupo já usa o nome.
   * @throws AccessGroupNotFoundError quando o grupo não existe na instalação.
   */
  update(
    appId: string,
    groupId: string,
    input: AccessGroupInput,
  ): Promise<AccessGroup>

  /** @returns `false` quando o grupo não existe na instalação. */
  remove(appId: string, groupId: string): Promise<boolean>
}
