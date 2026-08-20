import { describe, expect, it } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { resolveProvisioningAction } from './resolve-provisioning-action'

const ZAPI_PAIR = { zApiInstanceId: 'inst-1', zApiInstanceToken: 'tok-1' }
const CHANNEL = { hubmessageChannelId: 'chan-1' }

describe('resolveProvisioningAction', () => {
  describe('ZAPI', () => {
    it('sem credencial provisiona na Z-API', () => {
      expect(
        resolveProvisioningAction({ provider: 'ZAPI', credentials: {} }),
      ).toEqual({ kind: 'provision', provider: ConnectorProvider.ZAPI })
    })

    it('par completo não provisiona — é o item que a nossa API acabou de criar', () => {
      expect(
        resolveProvisioningAction({ provider: 'ZAPI', credentials: ZAPI_PAIR }),
      ).toEqual({
        kind: 'already-provisioned',
        provider: ConnectorProvider.ZAPI,
      })
    })

    it('par incompleto recusa: provisionar sobrescreveria o campo preenchido', () => {
      for (const credentials of [
        { zApiInstanceId: 'inst-1' },
        { zApiInstanceToken: 'tok-1' },
      ]) {
        const action = resolveProvisioningAction({
          provider: 'ZAPI',
          credentials,
        })

        expect(action.kind).toBe('refuse')
        expect(action).toMatchObject({ reason: 'zapi-pair-incomplete' })
      }
    })

    it('credencial da HubMessage num item ZAPI recusa', () => {
      expect(
        resolveProvisioningAction({ provider: 'ZAPI', credentials: CHANNEL }),
      ).toMatchObject({
        kind: 'refuse',
        reason: 'credential-provider-mismatch',
      })
    })
  })

  describe('HUBMESSAGE', () => {
    it('sem credencial provisiona na HubMessage', () => {
      expect(
        resolveProvisioningAction({ provider: 'HUBMESSAGE', credentials: {} }),
      ).toEqual({ kind: 'provision', provider: ConnectorProvider.HUBMESSAGE })
    })

    it('canal presente não provisiona', () => {
      expect(
        resolveProvisioningAction({
          provider: 'HUBMESSAGE',
          credentials: CHANNEL,
        }),
      ).toEqual({
        kind: 'already-provisioned',
        provider: ConnectorProvider.HUBMESSAGE,
      })
    })

    it('canal com WABA continua já provisionado', () => {
      expect(
        resolveProvisioningAction({
          provider: 'HUBMESSAGE',
          credentials: { ...CHANNEL, wabaId: 'waba-1' },
        }),
      ).toEqual({
        kind: 'already-provisioned',
        provider: ConnectorProvider.HUBMESSAGE,
      })
    })

    it('WABA sem canal recusa em vez de provisionar', () => {
      expect(
        resolveProvisioningAction({
          provider: 'HUBMESSAGE',
          credentials: { wabaId: 'waba-1' },
        }),
      ).toMatchObject({ kind: 'refuse', reason: 'orphan-waba' })
    })

    it('credencial da Z-API num item HUBMESSAGE recusa', () => {
      expect(
        resolveProvisioningAction({
          provider: 'HUBMESSAGE',
          credentials: ZAPI_PAIR,
        }),
      ).toMatchObject({
        kind: 'refuse',
        reason: 'credential-provider-mismatch',
      })
    })
  })

  describe('NONE', () => {
    it('sem credencial é item de cobrança, não erro', () => {
      expect(
        resolveProvisioningAction({ provider: 'NONE', credentials: {} }),
      ).toEqual({ kind: 'no-connector' })
    })

    it('com credencial de qualquer provider recusa', () => {
      for (const credentials of [ZAPI_PAIR, CHANNEL, { wabaId: 'waba-1' }]) {
        expect(
          resolveProvisioningAction({ provider: 'NONE', credentials }),
        ).toMatchObject({ kind: 'refuse', reason: 'none-with-credential' })
      }
    })
  })

  describe('provider não declarado ou desconhecido', () => {
    it('vazio é "não preenchido", nunca NONE', () => {
      expect(
        resolveProvisioningAction({ provider: '', credentials: {} }),
      ).toMatchObject({ kind: 'refuse', reason: 'provider-not-declared' })
    })

    it('valor fora do vocabulário recusa', () => {
      for (const provider of ['WHATSAPP', 'ZAPI2', 'TWILIO']) {
        expect(
          resolveProvisioningAction({ provider, credentials: {} }),
        ).toMatchObject({ kind: 'refuse', reason: 'provider-unknown' })
      }
    })

    it('provider inválido recusa mesmo com credencial preenchida', () => {
      expect(
        resolveProvisioningAction({ provider: '', credentials: ZAPI_PAIR }),
      ).toMatchObject({ kind: 'refuse', reason: 'provider-not-declared' })
    })
  })

  it('toda recusa carrega detalhe não vazio — é o que sai no log', () => {
    const refusals = [
      { provider: '', credentials: {} },
      { provider: 'TWILIO', credentials: {} },
      { provider: 'ZAPI', credentials: { zApiInstanceId: 'i' } },
      { provider: 'HUBMESSAGE', credentials: { wabaId: 'w' } },
      { provider: 'HUBMESSAGE', credentials: ZAPI_PAIR },
      { provider: 'NONE', credentials: CHANNEL },
    ]

    for (const input of refusals) {
      const action = resolveProvisioningAction(input)

      expect(action.kind).toBe('refuse')
      if (action.kind === 'refuse') {
        expect(action.detail.length).toBeGreaterThan(0)
      }
    }
  })
})
