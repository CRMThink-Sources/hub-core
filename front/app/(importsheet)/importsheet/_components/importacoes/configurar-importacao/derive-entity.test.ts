import { describe, expect, it } from 'vitest'
import { deriveEntity } from './derive-entity'

describe('deriveEntity', () => {
  it('vazio: nada selecionado', () => {
    const f = deriveEntity('', null)
    expect(f.entity).toBeNull()
    expect(f.perColumn).toBe(false)
    expect(f.resolvedEntityTypeId).toBeNull()
  })

  it('DEAL precisa de pipeline e é CRM-like', () => {
    const f = deriveEntity('DEAL', null)
    expect(f.needsPipeline).toBe(true)
    expect(f.isCrmLike).toBe(true)
    expect(f.resolvedEntityTypeId).toBe(2)
  })

  it('LEAD é CRM-like sem pipeline', () => {
    const f = deriveEntity('LEAD', null)
    expect(f.isCrmLike).toBe(true)
    expect(f.needsPipeline).toBe(false)
    expect(f.perColumn).toBe(true)
  })

  it('SPA resolve entityTypeId pelo spaTypeId', () => {
    expect(deriveEntity('SPA', 1056).resolvedEntityTypeId).toBe(1056)
    expect(deriveEntity('SPA', null).needsSpa).toBe(true)
  })

  it('CONTACT não mostra criar contato', () => {
    expect(deriveEntity('CONTACT', null).showCreateContact).toBe(false)
    expect(deriveEntity('CONTACT', null).showCreateCompany).toBe(true)
  })

  it('COMPANY não mostra criar empresa', () => {
    expect(deriveEntity('COMPANY', null).showCreateCompany).toBe(false)
  })

  it('TASK é por-coluna e isTask', () => {
    const f = deriveEntity('TASK', null)
    expect(f.isTask).toBe(true)
    expect(f.perColumn).toBe(true)
    expect(f.isCrmLike).toBe(false)
  })

  it('FEED é isFeed e não é por-coluna', () => {
    const f = deriveEntity('FEED', null)
    expect(f.isFeed).toBe(true)
    expect(f.perColumn).toBe(false)
  })
})
