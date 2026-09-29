import type { Tutorial, ApiOficialScreen } from '../../types'

const tutorial: Tutorial<ApiOficialScreen> = {
  slug: 'api-oficial',
  label: 'API oficial e templates',
  summary:
    'Linha na API oficial do WhatsApp, template aprovado pela Meta e envio pelo CRM.',
  steps: [
    {
      screen: 'lines',
      title: 'Crie uma linha nova',
      description: 'Em Conexões, clique em Nova linha.',
      action: 'Nova linha',
    },
    {
      screen: 'new-line',
      title: 'Escolha WhatsApp Oficial',
      description:
        'Selecione o conector WhatsApp Oficial — canal da Meta, com número verificado e templates — e o plano.',
      action: 'Criar linha',
    },
    {
      screen: 'pending-line',
      title: 'Abra a linha nova',
      description:
        'Ela aparece como Aguardando conexão. Clique para abrir as configurações.',
      action: 'Abrir a linha',
    },
    {
      screen: 'connect',
      title: 'Conecte o número na Meta',
      description:
        'Na aba Conexão, clique em Conectar número. A Meta abre a autenticação da sua conta do WhatsApp Business, e é lá que você escolhe o número.',
      action: 'Conectar número',
    },
    {
      screen: 'connected',
      title: 'Número conectado',
      description:
        'A linha fica ligada à sua conta do WhatsApp Business (WABA) e os templates passam a funcionar. Abra a aba Templates.',
      action: 'Templates',
    },
    {
      screen: 'templates',
      title: 'Crie um template',
      description:
        'Templates são mensagens aprovadas pela Meta para iniciar conversa fora da janela de 24h. Clique em Novo template.',
      action: 'Novo template',
    },
    {
      screen: 'template-form',
      title: 'Escreva e envie para aprovação',
      description:
        'Nome, categoria, idioma e corpo. {{1}} vira um dado do cliente na hora do envio, e a Meta pede um exemplo de cada variável.',
      action: 'Enviar para aprovação',
    },
    {
      screen: 'template-pending',
      title: 'Aguarde a aprovação',
      description:
        'O template fica Pendente até a Meta avaliar. Sincronizar busca o status atualizado.',
      action: 'Sincronizar',
    },
    {
      screen: 'crm-send',
      title: 'Envie pelo CRM',
      description:
        'No negócio, abra a aba ThinkZap, escolha a linha oficial, o número e o template. O mesmo template também pode sair por robô de automação ou por Campanha de SMS do Bitrix24.',
      action: 'Enviar',
    },
  ],
  done: {
    title: 'Template enviado pela API oficial',
    description:
      'Número verificado, template aprovado e envio sem sair do CRM. Vamos conectar o seu?',
  },
}

/**
 * Textos das telas simuladas de `tutorials/api-oficial.tsx`. O tipo sai daqui: a
 * versão em inglês precisa ter exatamente as mesmas chaves.
 */
const screens = {
  lineName: 'Linha 2',
  lines: {
    newLine: 'Nova linha',
    planSubtitle: 'Plano mensal',
    statusActive: 'Ativo',
    statusPending: 'Aguardando conexão',
  },
  newLine: {
    title: 'Criar nova linha',
    description:
      'Escolha o tipo de conector da linha nova. A cobrança é ajustada na sua assinatura atual.',
    oficialLabel: 'WhatsApp Oficial',
    planLabel: 'Escolher plano',
    planValue: 'Oficial · mês',
    cancel: 'Cancelar',
  },
  connection: {
    title: 'Conexão',
    description: 'Conecte o número desta linha à sua conta da Meta.',
    instructions:
      'Ao conectar, a Meta abre a autenticação da sua conta do WhatsApp Business. Ao final, o número fica ligado a esta linha e os templates passam a funcionar.',
    connectedBanner: 'Número conectado.',
    connectedDescription: 'Esta linha está conectada ao WhatsApp Oficial.',
    wabaLabel: 'Conta do WhatsApp Business (WABA)',
    connectedHint: 'Para trocar o número desta linha, fale com o suporte.',
  },
  templates: {
    title: 'Templates',
    description:
      'Modelos de mensagem aprovados pela Meta para iniciar conversas fora da janela de 24h.',
    sync: 'Sincronizar',
    newTemplate: 'Novo template',
    empty: 'Nenhum template cadastrado ainda.',
    pending: 'Pendente',
  },
  /** Template de exemplo, o mesmo do formulário ao envio pelo CRM. */
  template: {
    name: 'confirmacao_pedido',
    category: 'Utilidade',
    language: 'pt_BR',
    body: 'Olá {{1}}, seu pedido foi confirmado.',
    sample: 'Maria',
    footer: 'Loja Acme',
  },
  templateForm: {
    nameLabel: 'Nome do template',
    categoryLabel: 'Categoria',
    languageLabel: 'Idioma',
    bodyLabel: 'Corpo da mensagem',
    exampleLabel: 'Exemplo para {{1}}',
    footerLabel: 'Rodapé (opcional)',
    cancel: 'Cancelar',
  },
  crmSend: {
    lineLabel: 'Linha',
    recipientLabel: 'Destino',
    templateLabel: 'Template',
    approved: 'Aprovado',
    /** Corpo renderizado, com o valor de `template.sample` em negrito no meio. */
    previewBefore: 'Olá ',
    previewAfter: ', seu pedido foi confirmado.',
  },
}

export type ApiOficialCopy = {
  tutorial: Tutorial<ApiOficialScreen>
  screens: typeof screens
}

export const API_OFICIAL_PT: ApiOficialCopy = { tutorial, screens }
