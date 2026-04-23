/**
 * Converte uma string para o formato exigido pelo Bitrix para nomes de campos de dataset:
 * somente A-Z, 0-9 e _, máximo 32 caracteres, sem leading/trailing underscores.
 * Ex: "ID do Cliente" → "ID_DO_CLIENTE"
 */
export function toDatasetFieldName(str: string): string {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

/**
 * Converte uma string para o formato exigido pelo Bitrix para o name do dataset:
 * somente a-z, 0-9 e _, deve começar com letra minúscula, máximo 50 caracteres.
 * Ex: "Cobranças Asaas" → "cobrancas_asaas"
 */
export function toDatasetName(str: string): string {
  const normalized = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)

  return normalized || 'dataset'
}
