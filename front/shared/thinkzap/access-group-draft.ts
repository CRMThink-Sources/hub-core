/**
 * Edição de um grupo de acesso do widget: rascunho do painel e leitura da estrutura
 * de departamentos. Lógica pura, fora dos componentes, para ser testável sem DOM.
 */

export type AccessGroupDepartment = {
  departmentId: string
  includeSubdepartments: boolean
}

/** Grupo como `GET /thinkzap/access/groups` devolve. */
export type AccessGroup = {
  id: string
  name: string
  memberIds: string[]
  lineIds: string[]
  /** Ausente quando a API ainda não conhece departamentos (deploy em andamento). */
  departments?: AccessGroupDepartment[]
}

/** Departamento como `GET /thinkzap/portal-departments` devolve. */
export type PortalDepartment = {
  id: string
  name: string
  parentId: string | null
}

export type AccessGroupDraft = {
  name: string
  memberIds: string[]
  departments: AccessGroupDepartment[]
  lineIds: string[]
  /**
   * Linhas vinculadas que a tela não oferece (bloqueada, sem provider, vencida ou
   * excluída). São preservadas: sumir por um estado passageiro não apaga o vínculo.
   */
  hiddenLineIds: string[]
}

export function createDraft(
  group: AccessGroup | null,
  offeredLineIds: string[],
): AccessGroupDraft {
  const offered = new Set(offeredLineIds)
  const lineIds = group?.lineIds ?? []
  return {
    name: group?.name ?? '',
    memberIds: group?.memberIds ?? [],
    departments: group?.departments ?? [],
    lineIds: lineIds.filter(id => offered.has(id)),
    hiddenLineIds: lineIds.filter(id => !offered.has(id)),
  }
}

export function addMember(
  draft: AccessGroupDraft,
  id: string,
): AccessGroupDraft {
  if (draft.memberIds.includes(id)) return draft
  return { ...draft, memberIds: [...draft.memberIds, id] }
}

export function removeMember(
  draft: AccessGroupDraft,
  id: string,
): AccessGroupDraft {
  return { ...draft, memberIds: draft.memberIds.filter(x => x !== id) }
}

export function addDepartment(
  draft: AccessGroupDraft,
  departmentId: string,
  includeSubdepartments = false,
): AccessGroupDraft {
  if (draft.departments.some(d => d.departmentId === departmentId)) return draft
  return {
    ...draft,
    departments: [
      ...draft.departments,
      { departmentId, includeSubdepartments },
    ],
  }
}

export function removeDepartment(
  draft: AccessGroupDraft,
  departmentId: string,
): AccessGroupDraft {
  return {
    ...draft,
    departments: draft.departments.filter(d => d.departmentId !== departmentId),
  }
}

export function setIncludeSubdepartments(
  draft: AccessGroupDraft,
  departmentId: string,
  includeSubdepartments: boolean,
): AccessGroupDraft {
  return {
    ...draft,
    departments: draft.departments.map(d =>
      d.departmentId === departmentId ? { ...d, includeSubdepartments } : d,
    ),
  }
}

export function toggleLine(
  draft: AccessGroupDraft,
  id: string,
): AccessGroupDraft {
  return {
    ...draft,
    lineIds: draft.lineIds.includes(id)
      ? draft.lineIds.filter(x => x !== id)
      : [...draft.lineIds, id],
  }
}

/** Forma comparável: a ordem em que os itens foram marcados não é alteração. */
function fingerprint(draft: AccessGroupDraft): string {
  return JSON.stringify([
    draft.name.trim(),
    [...draft.memberIds].sort(),
    draft.departments
      .map(d => `${d.departmentId}:${d.includeSubdepartments}`)
      .sort(),
    [...draft.lineIds].sort(),
  ])
}

export function isDraftDirty(
  draft: AccessGroupDraft,
  original: AccessGroupDraft,
): boolean {
  return fingerprint(draft) !== fingerprint(original)
}

export function toGroupPayload(draft: AccessGroupDraft) {
  return {
    name: draft.name.trim(),
    memberIds: draft.memberIds,
    lineIds: [...draft.lineIds, ...draft.hiddenLineIds],
    departments: draft.departments,
  }
}

const PATH_SEPARATOR = ' › '

function pathOf(
  department: PortalDepartment,
  byId: Map<string, PortalDepartment>,
): string {
  const names: string[] = []
  const seen = new Set<string>()
  let current: PortalDepartment | undefined = department
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return names.join(PATH_SEPARATOR)
}

export type DepartmentDescription =
  | { status: 'found'; name: string; path: string }
  /** Gravado no grupo e excluído no portal. */
  | { status: 'missing' }
  /** A lista do portal não carregou: não dá para afirmar que foi excluído. */
  | { status: 'unknown' }

export function describeDepartment(
  id: string,
  departments: PortalDepartment[] | null,
): DepartmentDescription {
  if (!departments) return { status: 'unknown' }
  const byId = new Map(departments.map(d => [d.id, d]))
  const department = byId.get(id)
  if (!department) return { status: 'missing' }
  return {
    status: 'found',
    name: department.name,
    path: pathOf(department, byId),
  }
}

export type ListedDepartment = {
  id: string
  name: string
  /** Nível na árvore; `0` quando a lista vem de uma busca. */
  depth: number
  path: string
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Departamentos para escolher: sem busca, a árvore em ordem alfabética por nível; com
 * busca, os que casam pelo nome, identificados pelo caminho.
 */
export function listDepartments(
  departments: PortalDepartment[],
  query: string,
): ListedDepartment[] {
  const byId = new Map(departments.map(d => [d.id, d]))
  const sorted = [...departments].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  )

  const term = normalize(query.trim())
  if (term) {
    return sorted
      .filter(d => normalize(d.name).includes(term))
      .map(d => ({
        id: d.id,
        name: d.name,
        depth: 0,
        path: pathOf(d, byId),
      }))
  }

  const listed: ListedDepartment[] = []
  const seen = new Set<string>()
  const visit = (department: PortalDepartment, depth: number) => {
    if (seen.has(department.id)) return
    seen.add(department.id)
    listed.push({
      id: department.id,
      name: department.name,
      depth,
      path: pathOf(department, byId),
    })
    for (const child of sorted) {
      if (child.parentId === department.id) visit(child, depth + 1)
    }
  }
  for (const root of sorted) {
    if (!root.parentId || !byId.has(root.parentId)) visit(root, 0)
  }
  // Sobra só quem está num ciclo: aparece como raiz, para não sumir da escolha.
  for (const department of sorted) visit(department, 0)

  return listed
}
