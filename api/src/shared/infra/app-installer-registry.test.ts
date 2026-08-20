import { describe, expect, it, vi } from 'vitest'
import {
  AppInstallerRegistry,
  DuplicateAppInstallerError,
} from './app-installer-registry'
import type { AppInstaller } from '@/shared/domain/app-installer'

const installerFor = (appCode: string): AppInstaller => ({
  appCode,
  install: vi.fn(),
})

describe('AppInstallerRegistry', () => {
  it('resolve o installer pelo appCode', () => {
    const registry = new AppInstallerRegistry()
    const thinkzap = installerFor('crmthink.thinkzap')
    registry.register(thinkzap)
    registry.register(installerFor('crmthink.clicksign'))

    expect(registry.get('crmthink.thinkzap')).toBe(thinkzap)
  })

  it('devolve undefined para app sem installer', () => {
    const registry = new AppInstallerRegistry()

    expect(registry.get('crmthink.desconhecido')).toBeUndefined()
  })

  it('lança em appCode duplicado, em vez de sobrescrever', () => {
    const registry = new AppInstallerRegistry()
    registry.register(installerFor('crmthink.thinkzap'))

    expect(() => registry.register(installerFor('crmthink.thinkzap'))).toThrow(
      DuplicateAppInstallerError,
    )
  })
})
