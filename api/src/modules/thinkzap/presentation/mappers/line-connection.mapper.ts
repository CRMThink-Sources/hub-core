import type { LineConnectionReading } from '@/modules/thinkzap/application/get-line-connection'
import type { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'

/**
 * **Fronteira pública da API.** Nada sai daqui por spread da resposta do
 * provider: `InstanceDataResponse` carrega `token`, e a Z-API pode acrescentar
 * campo novo a qualquer momento. Campo só aparece no payload se alguém
 * acrescentar explicitamente neste arquivo.
 *
 * A tela que consome isto abre no iframe do Bitrix para qualquer usuário com JWT
 * válido do app, inclusive não-admin.
 */
export type LineConnectionView = {
  /**
   * Qual linha a tela está mostrando. Sai no payload porque os campos abaixo são
   * quase todos do caminho Z-API: sem o provider, a aba teria que adivinhar pela
   * ausência deles se está diante de uma linha oficial ou de uma Z-API que
   * degradou.
   */
  provider: 'ZAPI' | 'HUBMESSAGE'
  connected: boolean
  /**
   * `active` | `trial-expired` | `inactive`. Sempre presente, inclusive quando
   * desconectada: é o que diz à tela para explicar o bloqueio em vez de oferecer o
   * QR code, que a rota recusa.
   */
  entitlement: LineEntitlement
  /** Nome da linha no provider. */
  name?: string
  phone?: string
  /** URL da foto do perfil, hospedada pelo provider. */
  imgUrl?: string
  about?: string
  deviceModel?: string
  isBusiness?: boolean
  /**
   * WABA da linha oficial. Presente só depois do embedded signup — é ela que os
   * templates leem, e é por isso que a aba a mostra em vez de esconder o que
   * identifica a conta conectada.
   */
  wabaId?: string
}

/** Campo de texto do provider só entra se tiver conteúdo. */
const text = (value: string | undefined | null): string | undefined =>
  value && value.trim().length > 0 ? value : undefined

export const mapLineConnectionToView = (
  reading: LineConnectionReading,
): LineConnectionView => {
  /**
   * Linha oficial: só o que a HubMessage sabe dizer. Nada de `name`, `phone` ou
   * `imgUrl` — o que existe é o `phoneId`, que não é o número do cliente, e
   * apresentá-lo como se fosse mostraria dado errado na tela.
   */
  if (reading.provider === 'HUBMESSAGE') {
    const view: LineConnectionView = {
      provider: 'HUBMESSAGE',
      connected: reading.connected,
      entitlement: reading.entitlement,
    }

    if (reading.wabaId !== null) view.wabaId = reading.wabaId

    return view
  }

  const { instance, phone, entitlement } = reading

  const view: LineConnectionView = {
    provider: 'ZAPI',
    connected: instance.connected === true,
    entitlement,
  }

  if (!view.connected) {
    // Desconectada: nada de aparelho a mostrar, e o `name` da instância não
    // descreve o número — a UI mostra o QR code.
    return view
  }

  // `phone?.name` primeiro: é o nome do perfil do WhatsApp; o da instância é o
  // rótulo interno.
  const name = text(phone?.name) ?? text(instance.name)
  if (name !== undefined) view.name = name

  const phoneNumber = text(phone?.phone)
  if (phoneNumber !== undefined) view.phone = phoneNumber

  const imgUrl = text(phone?.imgUrl)
  if (imgUrl !== undefined) view.imgUrl = imgUrl

  const about = text(phone?.about)
  if (about !== undefined) view.about = about

  const deviceModel = text(phone?.device?.device_model)
  if (deviceModel !== undefined) view.deviceModel = deviceModel

  if (typeof phone?.isBusiness === 'boolean') {
    view.isBusiness = phone.isBusiness
  }

  return view
}
