import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'

export type ClickSignField = {
  code: string
  name: string
  type: string
  isMultiple: boolean
  crmContact: boolean
}

type RawField = {
  type?: string
  title?: string
  formLabel?: string
  isMultiple?: boolean
  settings?: { CONTACT?: string }
}

type FieldsResponse = { result?: Record<string, RawField> }

function normalize(fields: Record<string, RawField>): ClickSignField[] {
  return Object.entries(fields).map(([code, raw]) => ({
    code,
    name: raw.formLabel ?? raw.title ?? code,
    type: raw.type ?? 'string',
    isMultiple: raw.isMultiple ?? false,
    crmContact: raw.type === 'crm' && raw.settings?.CONTACT === 'Y',
  }))
}

export class ClickSignBitrixFieldsService {
  constructor(private readonly bitrix: BitrixClient) {}

  private async listFields(method: string): Promise<ClickSignField[]> {
    const res = await this.bitrix.callMethod<FieldsResponse>(method, {})
    return normalize(res.result ?? {})
  }

  listDealFields(): Promise<ClickSignField[]> {
    return this.listFields('crm.deal.fields')
  }

  listContactFields(): Promise<ClickSignField[]> {
    return this.listFields('crm.contact.fields')
  }
}
