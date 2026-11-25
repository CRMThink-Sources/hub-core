import { describe, expect, it } from 'vitest'
import {
  addDepartment,
  addMember,
  createDraft,
  describeDepartment,
  isDraftDirty,
  listDepartments,
  removeDepartment,
  removeMember,
  setIncludeSubdepartments,
  toGroupPayload,
  toggleLine,
  type AccessGroup,
} from './access-group-draft'

const group: AccessGroup = {
  id: 'g1',
  name: 'Vendas',
  memberIds: ['7', '8'],
  lineIds: ['100', '999'],
  departments: [{ departmentId: '10', includeSubdepartments: true }],
}

// Empresa > Comercial > SDR, e Empresa > Atendimento
const departments = [
  { id: '30', name: 'SDR', parentId: '10' },
  { id: '10', name: 'Comercial', parentId: '1' },
  { id: '1', name: 'Empresa', parentId: null },
  { id: '20', name: 'Atendimento', parentId: '1' },
]

describe('createDraft', () => {
  it('grupo novo começa vazio', () => {
    expect(createDraft(null, ['100'])).toEqual({
      name: '',
      memberIds: [],
      departments: [],
      lineIds: [],
      hiddenLineIds: [],
    })
  })

  it('separa as linhas que a tela não oferece', () => {
    const draft = createDraft(group, ['100'])

    expect(draft.lineIds).toEqual(['100'])
    expect(draft.hiddenLineIds).toEqual(['999'])
  })
})

describe('membros e departamentos', () => {
  const draft = createDraft(group, ['100'])

  it('adiciona e remove pessoa sem repetir', () => {
    expect(addMember(draft, '9').memberIds).toEqual(['7', '8', '9'])
    expect(addMember(draft, '7').memberIds).toEqual(['7', '8'])
    expect(removeMember(draft, '7').memberIds).toEqual(['8'])
  })

  it('adiciona departamento sem subdepartamentos por padrão', () => {
    expect(addDepartment(draft, '20').departments).toContainEqual({
      departmentId: '20',
      includeSubdepartments: false,
    })
  })

  it('departamento já adicionado mantém a escolha feita', () => {
    expect(addDepartment(draft, '10').departments).toEqual(group.departments)
  })

  it('altera a opção e remove o departamento', () => {
    expect(setIncludeSubdepartments(draft, '10', false).departments).toEqual([
      { departmentId: '10', includeSubdepartments: false },
    ])
    expect(removeDepartment(draft, '10').departments).toEqual([])
  })

  it('marca e desmarca linha', () => {
    expect(toggleLine(draft, '200').lineIds).toEqual(['100', '200'])
    expect(toggleLine(draft, '100').lineIds).toEqual([])
  })
})

describe('isDraftDirty', () => {
  const original = createDraft(group, ['100'])

  it('sem mudança, ou desfeita, não há o que descartar', () => {
    expect(isDraftDirty(original, original)).toBe(false)
    expect(
      isDraftDirty(addMember(removeMember(original, '7'), '7'), original),
    ).toBe(false)
  })

  it('percebe mudança em cada campo', () => {
    for (const changed of [
      { ...original, name: 'Outro' },
      addMember(original, '9'),
      removeDepartment(original, '10'),
      setIncludeSubdepartments(original, '10', false),
      toggleLine(original, '100'),
    ]) {
      expect(isDraftDirty(changed, original)).toBe(true)
    }
  })
})

describe('toGroupPayload', () => {
  it('apara o nome e devolve as linhas ocultas junto', () => {
    const draft = { ...createDraft(group, ['100']), name: '  Vendas ' }

    expect(toGroupPayload(draft)).toEqual({
      name: 'Vendas',
      memberIds: ['7', '8'],
      lineIds: ['100', '999'],
      departments: group.departments,
    })
  })
})

describe('describeDepartment', () => {
  it('monta o caminho desde a raiz', () => {
    expect(describeDepartment('30', departments)).toEqual({
      status: 'found',
      name: 'SDR',
      path: 'Empresa › Comercial › SDR',
    })
  })

  it('distingue excluído de lista não carregada', () => {
    expect(describeDepartment('77', departments)).toEqual({
      status: 'missing',
    })
    expect(describeDepartment('77', null)).toEqual({ status: 'unknown' })
  })

  it('ciclo na estrutura não trava', () => {
    const cycle = [
      { id: '1', name: 'A', parentId: '2' },
      { id: '2', name: 'B', parentId: '1' },
    ]
    expect(describeDepartment('1', cycle)).toEqual({
      status: 'found',
      name: 'A',
      path: 'B › A',
    })
  })
})

describe('listDepartments', () => {
  it('sem busca devolve a árvore em ordem, com o nível', () => {
    expect(
      listDepartments(departments, '').map(d => [d.name, d.depth]),
    ).toEqual([
      ['Empresa', 0],
      ['Atendimento', 1],
      ['Comercial', 1],
      ['SDR', 2],
    ])
  })

  it('trata como raiz quem aponta para um pai desconhecido', () => {
    const orphan = [{ id: '5', name: 'Solto', parentId: '404' }]
    expect(listDepartments(orphan, '')).toEqual([
      { id: '5', name: 'Solto', depth: 0, path: 'Solto' },
    ])
  })

  it('busca pelo nome sem diferenciar acento nem caixa', () => {
    const accented = [{ id: '1', name: 'Gestão', parentId: null }]
    expect(listDepartments(accented, 'GESTAO').map(d => d.id)).toEqual(['1'])
    expect(listDepartments(departments, 'com').map(d => d.path)).toEqual([
      'Empresa › Comercial',
    ])
  })
})
