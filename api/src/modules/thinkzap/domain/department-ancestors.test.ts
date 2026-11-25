import { describe, expect, it } from 'vitest'
import { departmentAncestors } from './department-ancestors'

const dep = (id: string, parentId: string | null) => ({
  id,
  name: id,
  parentId,
})

// 1 > 2 > 3, e 1 > 4 > 5
const tree = [
  dep('1', null),
  dep('2', '1'),
  dep('3', '2'),
  dep('4', '1'),
  dep('5', '4'),
]

describe('departmentAncestors', () => {
  it('sobe todos os níveis', () => {
    expect(departmentAncestors(['3'], tree).sort()).toEqual(['1', '2'])
  })

  it('junta os ancestrais de várias lotações sem repetir', () => {
    expect(departmentAncestors(['3', '5'], tree).sort()).toEqual([
      '1',
      '2',
      '4',
    ])
  })

  it('raiz e departamento desconhecido não têm ancestrais', () => {
    expect(departmentAncestors(['1', '99'], tree)).toEqual([])
  })

  it('um departamento superior não ganha os filhos', () => {
    expect(departmentAncestors(['2'], tree)).toEqual(['1'])
  })

  it('ciclo na estrutura não trava', () => {
    const cycle = [dep('1', '2'), dep('2', '1')]
    expect(departmentAncestors(['1'], cycle).sort()).toEqual(['1', '2'])
  })
})
