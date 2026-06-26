import { SIGNER_PART_OPTIONS } from './signer-part-options'

export const SIGNER_PART_FIELD = 'UF_CRM_SIGNER_PART'

export function buildSignerPartFieldParams(): Record<string, unknown> {
  return {
    fields: {
      FIELD_NAME: SIGNER_PART_FIELD,
      USER_TYPE_ID: 'enumeration',
      XML_ID: SIGNER_PART_FIELD,
      EDIT_FORM_LABEL: '[Clicksign] Assinar como',
      LIST_COLUMN_LABEL: '[Clicksign] Assinar como',
      SETTINGS: { DEFAULT_VALUE: '' },
      MULTIPLE: 'N',
      SHOW_FILTER: 'N',
      SHOW_IN_LIST: 'N',
      LIST: SIGNER_PART_OPTIONS.map(value => ({ VALUE: value })),
    },
  }
}
