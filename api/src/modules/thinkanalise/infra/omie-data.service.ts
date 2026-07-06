import {
  OmieClient,
  OmiePageStyle,
  omieToday,
} from '@/shared/infra/clients/omie.client'

type TableConfig = {
  resource: string
  call: string
  // chave do array na resposta OMIE (varia por endpoint)
  listKey: string
  pageStyle?: OmiePageStyle
  // code do schema → params OMIE de range de data daquele endpoint
  dateFilters?: Record<string, { de: string; ate: string }>
  fixedParams?: Record<string, unknown>
  // params computados no fetch, sobrescritos por filtro do BI (ex.: dDataPosicao = hoje)
  defaultParams?: () => Record<string, unknown>
  // 1 linha por elemento do array interno; campos do pai continuam acessíveis via dot-path
  explode?: string
  // params do request copiados p/ dentro de cada linha (ex.: dDataPosicao não vem na resposta)
  echoParams?: string[]
}

// ⚠️ listKey e semântica dos filtros a validar com credencial real (ver tasks/thinkanalise/omie.md)
const TABLE_CONFIG: Record<string, TableConfig> = {
  contas_pagar: {
    resource: 'financas/contapagar',
    call: 'ListarContasPagar',
    listKey: 'conta_pagar_cadastro',
    dateFilters: {
      // filtrar_por_data_de/ate seria inclusão/alteração — emissão tem filtro próprio (doc oficial)
      data_emissao: {
        de: 'filtrar_por_emissao_de',
        ate: 'filtrar_por_emissao_ate',
      },
    },
  },
  contas_receber: {
    resource: 'financas/contareceber',
    call: 'ListarContasReceber',
    listKey: 'conta_receber_cadastro',
    dateFilters: {
      data_emissao: {
        de: 'filtrar_por_emissao_de',
        ate: 'filtrar_por_emissao_ate',
      },
    },
  },
  movimentos_financeiros: {
    resource: 'financas/mf',
    call: 'ListarMovimentos',
    listKey: 'movimentos',
    pageStyle: 'nPagina',
    dateFilters: {
      'detalhes.dDtEmissao': { de: 'dDtEmisDe', ate: 'dDtEmisAte' },
      'detalhes.dDtVenc': { de: 'dDtVencDe', ate: 'dDtVencAte' },
      'detalhes.dDtPagamento': { de: 'dDtPagtoDe', ate: 'dDtPagtoAte' },
    },
  },
  contas_correntes: {
    resource: 'geral/contacorrente',
    call: 'ListarContasCorrentes',
    listKey: 'ListarContasCorrentes',
  },
  categorias: {
    resource: 'geral/categorias',
    call: 'ListarCategorias',
    listKey: 'categoria_cadastro',
  },
  departamentos: {
    resource: 'geral/departamentos',
    call: 'ListarDepartamentos',
    listKey: 'departamentos',
  },
  pedidos_venda: {
    resource: 'produtos/pedido',
    call: 'ListarPedidos',
    listKey: 'pedido_venda_produto',
    dateFilters: {
      // ⚠️ validar semântica: filtrar_por_data_de/ate pode ser inclusão/alteração
      'infoCadastro.dInc': {
        de: 'filtrar_por_data_de',
        ate: 'filtrar_por_data_ate',
      },
    },
  },
  pedidos_venda_itens: {
    resource: 'produtos/pedido',
    call: 'ListarPedidos',
    listKey: 'pedido_venda_produto',
    explode: 'det',
    dateFilters: {
      'infoCadastro.dInc': {
        de: 'filtrar_por_data_de',
        ate: 'filtrar_por_data_ate',
      },
    },
  },
  nfe_emitidas: {
    resource: 'produtos/nfconsultar',
    call: 'ListarNF',
    listKey: 'nfCadastro',
    dateFilters: {
      'ide.dEmi': { de: 'dEmiInicial', ate: 'dEmiFinal' },
    },
  },
  clientes: {
    resource: 'geral/clientes',
    call: 'ListarClientes',
    listKey: 'clientes_cadastro',
  },
  produtos: {
    resource: 'geral/produtos',
    call: 'ListarProdutosResumido',
    listKey: 'produto_servico_resumido',
  },
  vendedores: {
    resource: 'geral/vendedores',
    call: 'ListarVendedores',
    listKey: 'cadastro',
  },
  projetos: {
    resource: 'geral/projetos',
    call: 'ListarProjetos',
    listKey: 'cadastro',
  },
  posicao_estoque: {
    resource: 'estoque/consulta',
    call: 'ListarPosEstoque',
    listKey: 'produtos',
    pageStyle: 'nPagina',
    // dDataPosicao é obrigatório — hoje quando o BI não filtrar
    defaultParams: () => ({ dDataPosicao: omieToday() }),
    dateFilters: {
      dDataPosicao: { de: 'dDataPosicao', ate: 'dDataPosicao' },
    },
    echoParams: ['dDataPosicao'],
  },
  pedidos_compra: {
    resource: 'produtos/pedidocompra',
    call: 'PesquisarPedCompra',
    listKey: 'pedidos_pesquisa',
    pageStyle: 'nPaginaRegs',
    dateFilters: {
      // ⚠️ semântica de dDataInicial/dDataFinal não documentada — validar com credencial
      dDtPrevisao: { de: 'dDataInicial', ate: 'dDataFinal' },
    },
  },
}

function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur ?? null
}

// Filtro Bitrix "dd/mm/yyyy hh:mm:ss" → OMIE "dd/mm/yyyy"
function toOmieDate(value: string): string | null {
  const m = value.match(/^(\d{2}\/\d{2}\/\d{4})/)
  return m?.[1] ?? null
}

// Resposta OMIE "dd/mm/aaaa" → ISO "aaaa-mm-dd"
function omieDateToIso(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value
}

export class OmieDataService {
  constructor(private readonly client: OmieClient) {}

  async fetch(
    table: string,
    select: string[],
    mapFields: Record<string, string>, // externalCode → fieldName (Bitrix)
    maxRows = 1000,
    filter: Record<string, unknown> = {},
  ): Promise<unknown[][]> {
    const config = TABLE_CONFIG[table]
    if (!config) return [select]

    // Inverte mapFields: fieldName (Bitrix) → externalCode (dot-path OMIE)
    const nameToCode: Record<string, string> = {}
    for (const [code, fieldName] of Object.entries(mapFields)) {
      nameToCode[fieldName] = code
    }

    const params: Record<string, unknown> = {
      ...config.fixedParams,
      ...config.defaultParams?.(),
    }

    // Formato Bitrix: { ">=DATA_EMISSAO": "01/03/2026 00:00:00" }
    for (const [bitrixKey, value] of Object.entries(filter)) {
      const opMatch = bitrixKey.match(/^(>=|<=|>|<|!=|=?)(.+)$/)
      if (!opMatch) continue

      const operator = opMatch[1] || '='
      const fieldName = opMatch[2]
      if (!fieldName) continue

      const code = nameToCode[fieldName] ?? fieldName
      const range = config.dateFilters?.[code]
      if (!range) continue // filtro sem equivalente OMIE nessa tabela — ignora

      const date = toOmieDate(String(value))
      if (!date) continue

      if (operator === '>=' || operator === '>') {
        params[range.de] = date
      } else if (operator === '<=' || operator === '<') {
        params[range.ate] = date
      } else if (operator === '=') {
        params[range.de] = date
        params[range.ate] = date
      }
    }

    let rows = await this.client.list<Record<string, unknown>>(
      config.resource,
      config.call,
      config.listKey,
      params,
      maxRows,
      config.pageStyle ?? 'padrao',
    )

    if (config.explode) {
      const key = config.explode
      rows = rows
        .flatMap(row => {
          const children = row[key]
          if (!Array.isArray(children)) return []
          return children.map(child => ({
            ...row,
            ...(child as Record<string, unknown>),
          }))
        })
        .slice(0, maxRows) // maxRows conta itens, não pedidos
    }

    if (config.echoParams) {
      const echo = Object.fromEntries(
        config.echoParams
          .filter(p => params[p] !== undefined)
          .map(p => [p, params[p]]),
      )
      rows = rows.map(row => ({ ...echo, ...row }))
    }

    return [
      select,
      ...rows.map(row =>
        select.map(fieldName => {
          const code = nameToCode[fieldName] ?? fieldName
          return omieDateToIso(getByPath(row, code))
        }),
      ),
    ]
  }
}
