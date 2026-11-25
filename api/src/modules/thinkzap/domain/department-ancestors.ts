import type { Department } from './ports/department-directory.port'

/**
 * Todos os departamentos acima dos informados, em qualquer nível. São eles que, num
 * grupo marcado para incluir subdepartamentos, alcançam o usuário.
 */
export function departmentAncestors(
  departmentIds: string[],
  departments: Department[],
): string[] {
  const parentById = new Map(departments.map(d => [d.id, d.parentId]))
  const ancestors = new Set<string>()

  for (const id of departmentIds) {
    let parent = parentById.get(id)
    // Parar no já visitado evita refazer a subida e protege contra ciclo.
    while (parent && !ancestors.has(parent)) {
      ancestors.add(parent)
      parent = parentById.get(parent)
    }
  }

  return [...ancestors]
}
