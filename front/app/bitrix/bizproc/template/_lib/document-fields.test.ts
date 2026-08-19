import { describe, expect, it } from 'vitest'
import {
  filterFields,
  resolveFieldsQuery,
  toDocumentFields,
} from './document-fields'

describe('resolveFieldsQuery', () => {
  it('usa o método da entidade clássica', () => {
    expect(resolveFieldsQuery(['crm', 'CCrmDocumentDeal', 'DEAL'])).toEqual({
      method: 'crm.deal.fields',
      params: {},
    })

    expect(
      resolveFieldsQuery(['crm', 'CCrmDocumentLead', 'LEAD'])?.method,
    ).toBe('crm.lead.fields')
  })

  // Na SPA o segundo elemento é a classe `Bitrix\Crm\...\Document\Dynamic`, que não
  // participa da resolução: o que decide é o `DYNAMIC_<entityTypeId>`.
  it('usa crm.item.fields com o entityTypeId da SPA', () => {
    expect(
      resolveFieldsQuery(['crm', 'DocumentDynamic', 'DYNAMIC_1142']),
    ).toEqual({
      method: 'crm.item.fields',
      params: { entityTypeId: 1142, useOriginalUfNames: 'Y' },
    })
  })

  it('resolve orçamento e fatura inteligente por id fixo', () => {
    expect(resolveFieldsQuery(['crm', 'X', 'QUOTE'])?.params).toEqual({
      entityTypeId: 7,
      useOriginalUfNames: 'Y',
    })

    expect(resolveFieldsQuery(['crm', 'X', 'SMART_INVOICE'])?.params).toEqual({
      entityTypeId: 31,
      useOriginalUfNames: 'Y',
    })
  })

  /**
   * O robô não tem `FILTER`, então ele aparece na automação de listas e de tarefas.
   * Sem método conhecido a tela fica só com o modo literal, em vez de oferecer campo
   * que não resolve.
   */
  it('não consulta o que não sabe traduzir', () => {
    expect(
      resolveFieldsQuery(['lists', 'BizprocDocument', 'iblock_42']),
    ).toBeNull()
    expect(
      resolveFieldsQuery(['crm', 'CCrmDocumentInvoice', 'INVOICE']),
    ).toBeNull()
    expect(resolveFieldsQuery([])).toBeNull()
  })
})

describe('toDocumentFields', () => {
  it('põe os campos padrão antes dos personalizados', () => {
    expect(
      toDocumentFields({
        UF_CRM_PHONES: {
          formLabel: 'Telefones',
          type: 'string',
          isMultiple: true,
        },
        TITLE: { title: 'Título', type: 'string' },
        ID: { title: 'ID', type: 'integer' },
      }),
    ).toEqual([
      {
        id: 'ID',
        title: 'ID',
        type: 'integer',
        multiple: false,
        custom: false,
      },
      {
        id: 'TITLE',
        title: 'Título',
        type: 'string',
        multiple: false,
        custom: false,
      },
      {
        id: 'UF_CRM_PHONES',
        title: 'Telefones',
        type: 'string',
        multiple: true,
        custom: true,
      },
    ])
  })

  /**
   * Campo personalizado do CRM não traz `title` — traz `formLabel`/`listLabel`, e às
   * vezes um `title` que só repete o id. Ler só `title` fazia a lista inteira aparecer
   * como `UF_CRM_…`.
   */
  it('lê o rótulo do campo personalizado, ignorando title igual ao id', () => {
    expect(
      toDocumentFields({
        UF_CRM_A: { title: 'UF_CRM_A', formLabel: 'Celular do cliente' },
        UF_CRM_B: { listLabel: 'Documento' },
        UF_CRM_C: { filterLabel: 'Placa' },
      }).map(field => field.title),
    ).toEqual(['Celular do cliente', 'Documento', 'Placa'])
  })

  /**
   * `crm.item.fields` embrulha o mapa em `fields` e devolve a chave em camelCase. O id
   * gravado tem de ser o `upperName`: é a forma que o bizproc resolve.
   */
  it('desembrulha crm.item.fields e prefere upperName', () => {
    expect(
      toDocumentFields({
        fields: {
          ufCrm7_1712345678: {
            formLabel: 'Celular',
            type: 'string',
            upperName: 'UF_CRM_7_1712345678',
          },
          title: { title: 'Nome', type: 'string', upperName: 'TITLE' },
        },
      }),
    ).toEqual([
      {
        id: 'TITLE',
        title: 'Nome',
        type: 'string',
        multiple: false,
        custom: false,
      },
      {
        id: 'UF_CRM_7_1712345678',
        title: 'Celular',
        type: 'string',
        multiple: false,
        custom: true,
      },
    ])
  })

  it('cai no id quando o campo não tem rótulo nenhum', () => {
    expect(toDocumentFields({ UF_CRM_1: {} })[0]).toEqual({
      id: 'UF_CRM_1',
      title: 'UF_CRM_1',
      type: 'string',
      multiple: false,
      custom: true,
    })
  })

  it('trata resposta inesperada como lista vazia', () => {
    expect(toDocumentFields(null)).toEqual([])
    expect(toDocumentFields('erro')).toEqual([])
    expect(toDocumentFields(['TITLE'])).toEqual([])
  })
})

/**
 * `document_fields` do placement usa a forma do bizproc (`Name`, `Type`, `Multiple`),
 * diferente da do CRM (`title`, `type`, `isMultiple`). As duas viram a mesma lista.
 */
describe('toDocumentFields — forma do placement', () => {
  it('lê Name, Type e Multiple', () => {
    expect(
      toDocumentFields({
        TITLE: { Name: 'Nome', Type: 'string' },
        UF_CRM_TAGS: { Name: 'Etiquetas', Type: 'string', Multiple: 'Y' },
      }),
    ).toEqual([
      {
        id: 'TITLE',
        title: 'Nome',
        type: 'string',
        multiple: false,
        custom: false,
      },
      {
        id: 'UF_CRM_TAGS',
        title: 'Etiquetas',
        type: 'string',
        multiple: true,
        custom: true,
      },
    ])
  })
})

describe('filterFields', () => {
  const fields = toDocumentFields({
    ID: { Name: 'ID' },
    TITLE: { Name: 'Nome do negócio' },
    UF_CRM_CELULAR: { Name: 'Celular do cliente' },
    PARENT_ID_1276: { Name: 'Negócio vinculado' },
  })

  it('sem busca devolve tudo, na ordem que já vinha', () => {
    expect(filterFields(fields, '   ')).toEqual(fields)
  })

  it('casa no rótulo ignorando acento e caixa', () => {
    expect(filterFields(fields, 'negocio').map(f => f.id)).toEqual([
      'PARENT_ID_1276',
      'TITLE',
    ])
  })

  // Quem conhece o campo pelo id procura por ele.
  it('casa no id', () => {
    expect(filterFields(fields, 'uf_crm').map(f => f.id)).toEqual([
      'UF_CRM_CELULAR',
    ])
  })

  it('exige todos os termos, em qualquer ordem', () => {
    expect(filterFields(fields, 'cliente celular').map(f => f.id)).toEqual([
      'UF_CRM_CELULAR',
    ])
    expect(filterFields(fields, 'celular negocio')).toEqual([])
  })
})
