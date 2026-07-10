type TableEntry = { code: string; title: string }
type FieldEntry = { code: string; name: string; type: string }

// codes usam dot-path quando o campo é aninhado na resposta Bling (ex.: contato.nome)
// ⚠️ campos a validar com conta real / Swagger — ver tasks/thinkanalise/bling.md
// pedidos_venda_itens cortada da v1: itens só existem no GET por id (inviável a 3 req/s)

export const tables: TableEntry[] = [
  { code: 'contas_pagar', title: 'Contas a Pagar' },
  { code: 'contas_receber', title: 'Contas a Receber' },
  {
    code: 'categorias_receitas_despesas',
    title: 'Categorias de Receitas e Despesas',
  },
  { code: 'formas_pagamento', title: 'Formas de Pagamento' },
  { code: 'pedidos_venda', title: 'Pedidos de Venda' },
  { code: 'pedidos_compra', title: 'Pedidos de Compra' },
  { code: 'nfe_emitidas', title: 'Notas Fiscais (NF-e)' },
  { code: 'situacoes', title: 'Situações' },
  { code: 'contatos', title: 'Contatos (Clientes e Fornecedores)' },
  { code: 'produtos', title: 'Produtos' },
  { code: 'vendedores', title: 'Vendedores' },
  { code: 'categorias_produtos', title: 'Categorias de Produtos' },
]

const CONTA_TITULO_BASE: FieldEntry[] = [
  { code: 'id', name: 'ID do Título', type: 'double' },
  { code: 'situacao', name: 'Situação (código)', type: 'double' },
  { code: 'dataEmissao', name: 'Data de Emissão', type: 'date' },
  { code: 'vencimento', name: 'Data de Vencimento', type: 'date' },
  { code: 'valor', name: 'Valor', type: 'double' },
  { code: 'contato.id', name: 'ID do Contato', type: 'double' },
  { code: 'contato.nome', name: 'Nome do Contato', type: 'string' },
  {
    code: 'contato.numeroDocumento',
    name: 'CPF/CNPJ do Contato',
    type: 'string',
  },
  { code: 'formaPagamento.id', name: 'ID Forma de Pagamento', type: 'double' },
  { code: 'categoria.id', name: 'ID da Categoria', type: 'double' },
  { code: 'historico', name: 'Histórico', type: 'string' },
  { code: 'numeroDocumento', name: 'Nº do Documento', type: 'string' },
]

export const schema: Record<string, FieldEntry[]> = {
  contas_pagar: [
    ...CONTA_TITULO_BASE,
    { code: 'dataPagamento', name: 'Data de Pagamento', type: 'date' },
  ],

  contas_receber: [...CONTA_TITULO_BASE],

  categorias_receitas_despesas: [
    { code: 'id', name: 'ID da Categoria', type: 'double' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    { code: 'tipo', name: 'Tipo (1=Receita, 2=Despesa)', type: 'double' },
    { code: 'situacao', name: 'Situação (código)', type: 'double' },
  ],

  formas_pagamento: [
    { code: 'id', name: 'ID da Forma de Pagamento', type: 'double' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    {
      code: 'tipoPagamento',
      name: 'Tipo de Pagamento (código)',
      type: 'double',
    },
    { code: 'situacao', name: 'Situação (código)', type: 'double' },
  ],

  pedidos_venda: [
    { code: 'id', name: 'ID do Pedido', type: 'double' },
    { code: 'numero', name: 'Nº do Pedido', type: 'double' },
    { code: 'data', name: 'Data do Pedido', type: 'date' },
    { code: 'dataSaida', name: 'Data de Saída', type: 'date' },
    { code: 'dataPrevista', name: 'Data Prevista', type: 'date' },
    { code: 'total', name: 'Total do Pedido', type: 'double' },
    { code: 'totalProdutos', name: 'Total em Produtos', type: 'double' },
    { code: 'contato.id', name: 'ID do Cliente', type: 'double' },
    { code: 'contato.nome', name: 'Nome do Cliente', type: 'string' },
    {
      code: 'contato.numeroDocumento',
      name: 'CPF/CNPJ do Cliente',
      type: 'string',
    },
    { code: 'situacao.id', name: 'ID da Situação', type: 'double' },
    { code: 'situacao.valor', name: 'Situação (código)', type: 'double' },
    { code: 'loja.id', name: 'ID da Loja', type: 'double' },
  ],

  pedidos_compra: [
    { code: 'id', name: 'ID do Pedido', type: 'double' },
    { code: 'numero', name: 'Nº do Pedido', type: 'double' },
    { code: 'data', name: 'Data do Pedido', type: 'date' },
    { code: 'dataPrevista', name: 'Data Prevista', type: 'date' },
    { code: 'total', name: 'Total do Pedido', type: 'double' },
    { code: 'fornecedor.id', name: 'ID do Fornecedor', type: 'double' },
    { code: 'situacao.valor', name: 'Situação (código)', type: 'double' },
    { code: 'ordemCompra', name: 'Ordem de Compra', type: 'string' },
  ],

  nfe_emitidas: [
    { code: 'id', name: 'ID da Nota', type: 'double' },
    { code: 'tipo', name: 'Tipo (0=Entrada, 1=Saída)', type: 'double' },
    { code: 'situacao', name: 'Situação (código)', type: 'double' },
    { code: 'numero', name: 'Nº da Nota', type: 'string' },
    { code: 'dataEmissao', name: 'Data de Emissão', type: 'date' },
    { code: 'dataOperacao', name: 'Data de Operação', type: 'date' },
    { code: 'contato.id', name: 'ID do Contato', type: 'double' },
    { code: 'contato.nome', name: 'Nome do Contato', type: 'string' },
    {
      code: 'contato.numeroDocumento',
      name: 'CPF/CNPJ do Contato',
      type: 'string',
    },
    // ⚠️ valor pode não vir na listagem — validar; se ausente, usar pedidos_venda.total
    { code: 'valorNota', name: 'Valor da Nota', type: 'double' },
  ],

  situacoes: [
    { code: 'id', name: 'ID da Situação', type: 'double' },
    { code: 'nome', name: 'Nome da Situação', type: 'string' },
    { code: 'idHerdado', name: 'ID Herdado (0 = situação custom)', type: 'double' },
    { code: 'cor', name: 'Cor', type: 'string' },
    { code: 'modulo.id', name: 'ID do Módulo', type: 'double' },
    { code: 'modulo.nome', name: 'Nome do Módulo', type: 'string' },
  ],

  contatos: [
    { code: 'id', name: 'ID do Contato', type: 'double' },
    { code: 'nome', name: 'Nome', type: 'string' },
    { code: 'codigo', name: 'Código', type: 'string' },
    { code: 'situacao', name: 'Situação', type: 'string' },
    { code: 'numeroDocumento', name: 'CPF/CNPJ', type: 'string' },
    { code: 'telefone', name: 'Telefone', type: 'string' },
    { code: 'celular', name: 'Celular', type: 'string' },
  ],

  produtos: [
    { code: 'id', name: 'ID do Produto', type: 'double' },
    { code: 'nome', name: 'Nome', type: 'string' },
    { code: 'codigo', name: 'Código (SKU)', type: 'string' },
    { code: 'preco', name: 'Preço de Venda', type: 'double' },
    { code: 'precoCusto', name: 'Preço de Custo', type: 'double' },
    { code: 'tipo', name: 'Tipo (P=Produto, S=Serviço)', type: 'string' },
    { code: 'situacao', name: 'Situação', type: 'string' },
    { code: 'formato', name: 'Formato (S/V/E)', type: 'string' },
    // a listagem de produtos já traz o saldo — posição de estoque atual sem tabela dedicada
    {
      code: 'estoque.saldoVirtualTotal',
      name: 'Saldo de Estoque (virtual)',
      type: 'double',
    },
  ],

  vendedores: [
    { code: 'id', name: 'ID do Vendedor', type: 'double' },
    { code: 'descontoLimite', name: 'Limite de Desconto (%)', type: 'double' },
    { code: 'loja.id', name: 'ID da Loja', type: 'double' },
    { code: 'contato.id', name: 'ID do Contato', type: 'double' },
    { code: 'contato.nome', name: 'Nome', type: 'string' },
  ],

  categorias_produtos: [
    { code: 'id', name: 'ID da Categoria', type: 'double' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    { code: 'categoriaPai.id', name: 'ID da Categoria Pai', type: 'double' },
  ],
}
