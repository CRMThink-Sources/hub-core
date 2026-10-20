import { describe, expect, it } from 'vitest'
import {
  hasPersistedSettings,
  settingsToMigrate,
} from './resolve-connector-settings-backfill'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

describe('hasPersistedSettings', () => {
  /**
   * É o critério de idempotência: item já preenchido é pulado, nunca sobrescrito.
   * Se isto devolver `false` para um item configurado, o backfill apaga a
   * configuração do cliente — e não há como desfazer.
   */
  it('reconhece campo já preenchido', () => {
    expect(
      hasPersistedSettings(JSON.stringify(DEFAULT_CONNECTOR_SETTINGS)),
    ).toBe(true)
    expect(hasPersistedSettings('{"widgetOpenChannelEnabled":true}')).toBe(true)
    // Objeto vazio ainda é gravação deliberada: alguém escreveu ali.
    expect(hasPersistedSettings('{}')).toBe(true)
  })

  it('trata ausente, vazio e branco como não preenchido', () => {
    expect(hasPersistedSettings(undefined)).toBe(false)
    expect(hasPersistedSettings(null)).toBe(false)
    expect(hasPersistedSettings('')).toBe(false)
    expect(hasPersistedSettings('   ')).toBe(false)
  })

  /** JSON torto no destino não trava o backfill: é exatamente o que ele conserta. */
  it('trata JSON malformado e não-objeto como não preenchido', () => {
    expect(hasPersistedSettings('{nao é json')).toBe(false)
    expect(hasPersistedSettings('"texto"')).toBe(false)
    expect(hasPersistedSettings('42')).toBe(false)
    expect(hasPersistedSettings('null')).toBe(false)
  })

  /** O campo da SPA é texto: valor não-string vindo da API não conta como gravado. */
  it('ignora valor que não é string', () => {
    expect(hasPersistedSettings({ widgetOpenChannelEnabled: true })).toBe(false)
    expect(hasPersistedSettings(1)).toBe(false)
  })
})

describe('settingsToMigrate', () => {
  it('migra o valor da coluna completando com os defaults', () => {
    expect(settingsToMigrate({ widgetOpenChannelEnabled: true })).toEqual({
      ...DEFAULT_CONNECTOR_SETTINGS,
      widgetOpenChannelEnabled: true,
    })
  })

  it('migra os dois toggles quando a coluna está completa', () => {
    const full = {
      prefixOperatorNameEnabled: true,
      widgetOpenChannelEnabled: true,
    }

    // Os campos do limite diário não existiam na coluna legada: saem com o default.
    expect(settingsToMigrate(full)).toEqual({
      ...full,
      dailyLimitEnabled: false,
      dailyLimit: null,
      deviceMessageMirrorEnabled: false,
    })
  })

  /**
   * Coluna gravada antes da descontinuação da sincronização de exclusão. A chave é
   * descartada, e as três que restam mantêm os valores do cliente — cair nos
   * defaults aqui religaria `prefixOperatorNameEnabled` em quase toda a base.
   */
  it('descarta as chaves descontinuadas sem perder as demais', () => {
    const legado = {
      prefixOperatorNameEnabled: true,
      messageUpdateEventEnabled: false,
      messageDeleteEventEnabled: false,
      widgetOpenChannelEnabled: true,
    }

    expect(settingsToMigrate(legado)).toEqual({
      prefixOperatorNameEnabled: true,
      widgetOpenChannelEnabled: true,
      dailyLimitEnabled: false,
      dailyLimit: null,
      deviceMessageMirrorEnabled: false,
    })
  })

  /**
   * Coluna sem informação não gasta um `crm.item.update`: a leitura do item vazio
   * já resolve `DEFAULT_CONNECTOR_SETTINGS`, então gravar os defaults não muda
   * nada observável.
   */
  it('não migra coluna sem informação', () => {
    expect(settingsToMigrate(null)).toBeNull()
    expect(settingsToMigrate(undefined)).toBeNull()
    expect(settingsToMigrate({})).toBeNull()
  })

  it('não migra valor que não é objeto', () => {
    expect(settingsToMigrate('true')).toBeNull()
    expect(settingsToMigrate(0)).toBeNull()
  })

  /** Shape estranho vira default, que é o que o leitor antigo já via na coluna. */
  it('migra shape inesperado como default', () => {
    expect(settingsToMigrate({ naoExiste: 'x' })).toEqual(
      DEFAULT_CONNECTOR_SETTINGS,
    )
  })
})
