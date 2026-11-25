export type Department = {
  id: string
  name: string
  /** `null` na raiz do portal. */
  parentId: string | null
}

/** Estrutura de departamentos do portal Bitrix24 de uma instalação. */
export interface DepartmentDirectory {
  list(installedAppId: string): Promise<Department[]>
}
