/** Departamento do Bitrix no grupo. */
export type AccessGroupDepartment = {
  departmentId: string
  /** Quem está lotado em qualquer nível abaixo também pertence ao grupo. */
  includeSubdepartments: boolean
}

/**
 * Grupo de acesso do widget: quais linhas (itens da SPA de assinaturas, por
 * `subscriptionItemId`) os membros (usuários e departamentos do Bitrix) podem usar ao
 * enviar pelo widget.
 */
export type AccessGroup = {
  id: string
  appId: string
  name: string
  memberIds: string[]
  lineIds: string[]
  departments: AccessGroupDepartment[]
  createdAt: Date
  updatedAt: Date
}

export type AccessGroupInput = {
  name: string
  memberIds: string[]
  lineIds: string[]
  /**
   * Ausente = não mexer: uma tela antiga, que não conhece departamentos, não pode
   * apagá-los ao salvar.
   */
  departments?: AccessGroupDepartment[]
}
