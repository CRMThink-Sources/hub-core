type TableEntry = { code: string; title: string }
type FieldEntry = { code: string; name: string; type: string }

// codes usam dot-path quando o campo é aninhado na resposta OMIE (ex.: detalhes.dDtVenc)
// ⚠️ nomes de campo a validar com credencial real — ver tasks/thinkanalise/omie.md

export const tables: TableEntry[] = [
  { code: 'contas_pagar', title: 'Contas a Pagar' },
  { code: 'contas_receber', title: 'Contas a Receber' },
  { code: 'movimentos_financeiros', title: 'Movimentos Financeiros' },
  { code: 'contas_correntes', title: 'Contas Correntes' },
  { code: 'categorias', title: 'Categorias' },
  { code: 'departamentos', title: 'Departamentos' },
  { code: 'pedidos_venda', title: 'Pedidos de Venda' },
  { code: 'pedidos_venda_itens', title: 'Itens de Pedido de Venda' },
  { code: 'nfe_emitidas', title: 'Notas Fiscais Emitidas' },
  { code: 'clientes', title: 'Clientes e Fornecedores' },
  { code: 'produtos', title: 'Produtos' },
  { code: 'vendedores', title: 'Vendedores' },
  { code: 'projetos', title: 'Projetos' },
  { code: 'posicao_estoque', title: 'Posição de Estoque' },
  { code: 'pedidos_compra', title: 'Pedidos de Compra' },
]

// Tabelas condicionadas a módulo do plano OMIE — /tables só expõe após probe (omie-capabilities)
export const moduleByTable: Record<string, 'estoque' | 'compras'> = {
  posicao_estoque: 'estoque',
  pedidos_compra: 'compras',
}

const CONTA_TITULO_BASE: FieldEntry[] = [
  { code: 'codigo_lancamento_omie', name: 'ID do Lançamento', type: 'double' },
  {
    code: 'codigo_cliente_fornecedor',
    name: 'Cód. Cliente/Fornecedor',
    type: 'double',
  },
  { code: 'numero_documento', name: 'Nº do Documento', type: 'string' },
  { code: 'numero_documento_fiscal', name: 'Nº Doc. Fiscal', type: 'string' },
  { code: 'data_emissao', name: 'Data de Emissão', type: 'date' },
  { code: 'data_vencimento', name: 'Data de Vencimento', type: 'date' },
  { code: 'data_previsao', name: 'Data de Previsão', type: 'date' },
  { code: 'valor_documento', name: 'Valor do Documento', type: 'double' },
  { code: 'status_titulo', name: 'Status do Título', type: 'string' },
  { code: 'codigo_categoria', name: 'Categoria', type: 'string' },
  { code: 'id_conta_corrente', name: 'ID Conta Corrente', type: 'double' },
  { code: 'numero_parcela', name: 'Parcela', type: 'string' },
  { code: 'codigo_tipo_documento', name: 'Tipo de Documento', type: 'string' },
  { code: 'observacao', name: 'Observação', type: 'string' },
]

export const schema: Record<string, FieldEntry[]> = {
  contas_pagar: [
    ...CONTA_TITULO_BASE,
    { code: 'data_entrada', name: 'Data de Entrada', type: 'date' },
  ],

  contas_receber: [...CONTA_TITULO_BASE],

  movimentos_financeiros: [
    { code: 'detalhes.nCodTitulo', name: 'ID do Título', type: 'double' },
    { code: 'detalhes.cNumTitulo', name: 'Nº do Título', type: 'string' },
    { code: 'detalhes.cNatureza', name: 'Natureza (P/R)', type: 'string' },
    { code: 'detalhes.cStatus', name: 'Status', type: 'string' },
    {
      code: 'detalhes.nCodCliente',
      name: 'Cód. Cliente/Fornecedor',
      type: 'double',
    },
    { code: 'detalhes.cCodCateg', name: 'Categoria', type: 'string' },
    { code: 'detalhes.nCodCC', name: 'ID Conta Corrente', type: 'double' },
    { code: 'detalhes.dDtEmissao', name: 'Data de Emissão', type: 'date' },
    { code: 'detalhes.dDtVenc', name: 'Data de Vencimento', type: 'date' },
    { code: 'detalhes.dDtPagamento', name: 'Data de Pagamento', type: 'date' },
    { code: 'detalhes.dDtPrevisao', name: 'Data de Previsão', type: 'date' },
    { code: 'detalhes.nValorTitulo', name: 'Valor do Título', type: 'double' },
    { code: 'resumo.nValPago', name: 'Valor Pago', type: 'double' },
    { code: 'resumo.nValAberto', name: 'Valor em Aberto', type: 'double' },
    { code: 'resumo.nDesconto', name: 'Desconto', type: 'double' },
    { code: 'resumo.nJuros', name: 'Juros', type: 'double' },
    { code: 'resumo.nMulta', name: 'Multa', type: 'double' },
    { code: 'resumo.nValLiquido', name: 'Valor Líquido', type: 'double' },
  ],

  contas_correntes: [
    { code: 'nCodCC', name: 'ID da Conta', type: 'double' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    { code: 'codigo_banco', name: 'Banco', type: 'string' },
    { code: 'codigo_agencia', name: 'Agência', type: 'string' },
    { code: 'numero_conta_corrente', name: 'Nº da Conta', type: 'string' },
    { code: 'tipo_conta_corrente', name: 'Tipo', type: 'string' },
    { code: 'saldo_inicial', name: 'Saldo Inicial', type: 'double' },
  ],

  categorias: [
    { code: 'codigo', name: 'Código', type: 'string' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    { code: 'descricao_padrao', name: 'Descrição Padrão', type: 'string' },
    { code: 'categoria_superior', name: 'Categoria Superior', type: 'string' },
    { code: 'conta_despesa', name: 'Conta de Despesa (S/N)', type: 'string' },
    { code: 'conta_receita', name: 'Conta de Receita (S/N)', type: 'string' },
    { code: 'totalizadora', name: 'Totalizadora (S/N)', type: 'string' },
    { code: 'nao_exibir', name: 'Não Exibir (S/N)', type: 'string' },
    { code: 'codigo_dre', name: 'Código DRE', type: 'string' },
  ],

  departamentos: [
    { code: 'codigo', name: 'Código', type: 'string' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    { code: 'estrutura', name: 'Estrutura', type: 'string' },
    { code: 'inativo', name: 'Inativo (S/N)', type: 'string' },
  ],

  pedidos_venda: [
    { code: 'cabecalho.codigo_pedido', name: 'ID do Pedido', type: 'double' },
    { code: 'cabecalho.numero_pedido', name: 'Nº do Pedido', type: 'string' },
    { code: 'cabecalho.codigo_cliente', name: 'Cód. Cliente', type: 'double' },
    { code: 'cabecalho.etapa', name: 'Etapa', type: 'string' },
    { code: 'cabecalho.origem_pedido', name: 'Origem', type: 'string' },
    {
      code: 'cabecalho.data_previsao',
      name: 'Data de Previsão',
      type: 'date',
    },
    {
      code: 'cabecalho.quantidade_itens',
      name: 'Qtd. de Itens',
      type: 'double',
    },
    {
      code: 'informacoes_adicionais.codVend',
      name: 'Cód. Vendedor',
      type: 'double',
    },
    {
      code: 'informacoes_adicionais.codigo_categoria',
      name: 'Categoria',
      type: 'string',
    },
    {
      code: 'informacoes_adicionais.numero_pedido_cliente',
      name: 'Nº Pedido do Cliente',
      type: 'string',
    },
    { code: 'infoCadastro.dInc', name: 'Data de Inclusão', type: 'date' },
    {
      code: 'total_pedido.valor_mercadorias',
      name: 'Valor Mercadorias',
      type: 'double',
    },
    {
      code: 'total_pedido.valor_descontos',
      name: 'Valor Descontos',
      type: 'double',
    },
    {
      code: 'total_pedido.valor_total_pedido',
      name: 'Valor Total',
      type: 'double',
    },
  ],

  pedidos_venda_itens: [
    // campos do pai (pedido) — acessíveis porque o explode preserva o objeto original
    { code: 'cabecalho.codigo_pedido', name: 'ID do Pedido', type: 'double' },
    { code: 'cabecalho.numero_pedido', name: 'Nº do Pedido', type: 'string' },
    { code: 'cabecalho.codigo_cliente', name: 'Cód. Cliente', type: 'double' },
    { code: 'cabecalho.etapa', name: 'Etapa', type: 'string' },
    {
      code: 'informacoes_adicionais.codVend',
      name: 'Cód. Vendedor',
      type: 'double',
    },
    // campos do item (elemento de det[])
    { code: 'produto.codigo_produto', name: 'Cód. Produto', type: 'double' },
    { code: 'produto.codigo', name: 'Código (SKU)', type: 'string' },
    { code: 'produto.descricao', name: 'Descrição do Produto', type: 'string' },
    { code: 'produto.unidade', name: 'Unidade', type: 'string' },
    { code: 'produto.quantidade', name: 'Quantidade', type: 'double' },
    { code: 'produto.valor_unitario', name: 'Valor Unitário', type: 'double' },
    { code: 'produto.valor_desconto', name: 'Valor Desconto', type: 'double' },
    {
      code: 'produto.percentual_desconto',
      name: '% Desconto',
      type: 'double',
    },
    {
      code: 'produto.valor_total',
      name: 'Valor Total do Item',
      type: 'double',
    }, // ⚠️ validar existência
  ],

  nfe_emitidas: [
    { code: 'compl.nIdNF', name: 'ID da NF', type: 'double' },
    { code: 'compl.cChaveNFe', name: 'Chave NF-e', type: 'string' },
    { code: 'ide.nNF', name: 'Nº da NF', type: 'string' },
    { code: 'ide.serie', name: 'Série', type: 'string' },
    { code: 'ide.dEmi', name: 'Data de Emissão', type: 'date' },
    { code: 'nfDestInt.nCodCli', name: 'Cód. Cliente', type: 'double' },
    { code: 'total.ICMSTot.vNF', name: 'Valor da NF', type: 'double' },
    { code: 'total.ICMSTot.vProd', name: 'Valor Produtos', type: 'double' },
    { code: 'total.ICMSTot.vDesc', name: 'Valor Descontos', type: 'double' },
  ],

  clientes: [
    { code: 'codigo_cliente_omie', name: 'ID do Cliente', type: 'double' },
    {
      code: 'codigo_cliente_integracao',
      name: 'Cód. de Integração',
      type: 'string',
    },
    { code: 'razao_social', name: 'Razão Social', type: 'string' },
    { code: 'nome_fantasia', name: 'Nome Fantasia', type: 'string' },
    { code: 'cnpj_cpf', name: 'CNPJ/CPF', type: 'string' },
    { code: 'email', name: 'E-mail', type: 'string' },
    { code: 'telefone1_ddd', name: 'DDD', type: 'string' },
    { code: 'telefone1_numero', name: 'Telefone', type: 'string' },
    { code: 'endereco', name: 'Endereço', type: 'string' },
    { code: 'bairro', name: 'Bairro', type: 'string' },
    { code: 'cidade', name: 'Cidade', type: 'string' },
    { code: 'estado', name: 'UF', type: 'string' },
    { code: 'cep', name: 'CEP', type: 'string' },
    { code: 'contato', name: 'Contato', type: 'string' },
    { code: 'pessoa_fisica', name: 'Pessoa Física (S/N)', type: 'string' },
    { code: 'inativo', name: 'Inativo (S/N)', type: 'string' },
  ],

  produtos: [
    { code: 'codigo_produto', name: 'ID do Produto', type: 'double' },
    { code: 'codigo', name: 'Código (SKU)', type: 'string' },
    { code: 'descricao', name: 'Descrição', type: 'string' },
    { code: 'valor_unitario', name: 'Valor Unitário', type: 'double' },
  ],

  vendedores: [
    { code: 'codigo', name: 'ID do Vendedor', type: 'double' },
    { code: 'nome', name: 'Nome', type: 'string' },
    { code: 'email', name: 'E-mail', type: 'string' },
    { code: 'inativo', name: 'Inativo (S/N)', type: 'string' },
    { code: 'comissao', name: '% Comissão', type: 'double' },
  ],

  projetos: [
    { code: 'codigo', name: 'ID do Projeto', type: 'double' },
    { code: 'nome', name: 'Nome', type: 'string' },
    { code: 'inativo', name: 'Inativo (S/N)', type: 'string' },
  ],

  posicao_estoque: [
    // dDataPosicao é echo do request (não vem na resposta) — data da fotografia do estoque
    { code: 'dDataPosicao', name: 'Data da Posição', type: 'date' },
    { code: 'nCodProd', name: 'ID do Produto', type: 'double' },
    { code: 'cCodigo', name: 'Código (SKU)', type: 'string' },
    { code: 'cCodInt', name: 'Cód. de Integração', type: 'string' },
    { code: 'cDescricao', name: 'Descrição', type: 'string' },
    { code: 'nPrecoUnitario', name: 'Preço Unitário', type: 'double' },
    { code: 'nSaldo', name: 'Saldo', type: 'double' },
    { code: 'fisico', name: 'Estoque Físico', type: 'double' },
    { code: 'reservado', name: 'Reservado', type: 'double' },
    { code: 'nPendente', name: 'Pendente (Pedidos)', type: 'double' },
    { code: 'estoque_minimo', name: 'Estoque Mínimo', type: 'double' },
    { code: 'nCMC', name: 'Custo Médio (CMC)', type: 'double' },
    {
      code: 'codigo_local_estoque',
      name: 'Cód. Local de Estoque',
      type: 'double',
    },
  ],

  pedidos_compra: [
    // PesquisarPedCompra retorna resultado flat (sem cabecalho aninhado) — doc oficial
    { code: 'nCodPed', name: 'ID do Pedido', type: 'double' },
    { code: 'cCodIntPed', name: 'Cód. de Integração', type: 'string' },
    { code: 'cNumero', name: 'Nº do Pedido', type: 'string' },
    { code: 'nCodFor', name: 'Cód. Fornecedor', type: 'double' },
    { code: 'dDtPrevisao', name: 'Data de Previsão', type: 'date' },
  ],
}
