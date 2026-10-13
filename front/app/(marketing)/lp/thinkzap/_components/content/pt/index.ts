import type { LpContent } from '../types'
import { API_OFICIAL_PT } from './tutorials/api-oficial'
import { ATIVACAO_PT } from './tutorials/ativacao'
import { GRUPOS_PT } from './tutorials/grupos'
import { INSTALACAO_PT } from './tutorials/instalacao'
import { ROBOS_PT } from './tutorials/robos'
import { THINKBOT_PT } from './tutorials/thinkbot'
import { THINKZAP_TRIAL_DURATION_DAYS } from '@/shared/constants/thinkzap-trial'

/**
 * Toda a copy da LP do ThinkZap em português, num lugar só, para o comercial
 * revisar sem procurar texto no JSX. Os textos de cada tutorial ficam em
 * `tutorials/<slug>.ts`. Os ícones ficam nos componentes; aqui só a chave.
 */
export const PT: LpContent = {
  locale: 'pt',
  htmlLang: 'pt-BR',
  metadata: {
    title: 'ThinkZap — WhatsApp integrado ao Bitrix24',
    description:
      'Conecte o WhatsApp Web e a API oficial do WhatsApp ao Bitrix24: várias linhas, botões interativos, templates, robôs de automação e histórico no CRM.',
    ogLocale: 'pt_BR',
  },
  whatsappMessage:
    'Olá! Vim pela página do ThinkZap e quero saber mais sobre o WhatsApp no Bitrix24.',
  nav: {
    features: 'Funcionalidades',
    tutorials: 'Tutoriais',
    faq: 'Dúvidas',
    install: 'Instalar',
  },
  languageSwitch: { label: 'Idioma' },
  hero: {
    eyebrow: 'WhatsApp dentro do Bitrix24',
    title: 'Atenda, venda e automatize pelo WhatsApp sem sair do seu CRM',
    subtitle:
      'O ThinkZap conecta o WhatsApp Web e a API oficial do WhatsApp ao Bitrix24. Conversas caem nas linhas abertas, ficam no histórico do cliente e entram nas suas automações.',
  },
  chatPreview: {
    contactDetail: 'WhatsApp · Linha Vendas · Negócio #1042',
    messages: {
      question: 'Oi! Vocês entregam para Curitiba?',
      answer: 'Entregamos sim, Maria! Quer que eu envie o orçamento?',
      ask: 'Como prefere receber?',
      options: ['Por aqui', 'Por e-mail'],
      reply: 'Por aqui mesmo 😊',
    },
    robot: {
      before: 'Robô do Bitrix24: negócio movido para',
      stage: 'Proposta enviada',
    },
  },
  features: {
    title: 'Tudo o que sua equipe precisa no WhatsApp',
    subtitle: 'Do primeiro contato ao pós-venda, com o histórico no CRM.',
    items: [
      {
        icon: 'channels',
        title: 'WhatsApp Web e API oficial',
        description:
          'Use o número que você já tem pelo WhatsApp Web ou conecte a API oficial do WhatsApp Business — os dois no mesmo painel.',
      },
      {
        icon: 'lines',
        title: 'Várias linhas',
        description:
          'Conecte quantos números precisar e ligue cada um a uma linha aberta do Bitrix24, por equipe ou operação.',
      },
      {
        icon: 'buttons',
        title: 'Botões interativos',
        description:
          'Envie mensagens com botões de resposta e registre o que o cliente escolheu direto na timeline.',
      },
      {
        icon: 'templates',
        title: 'Templates de mensagem',
        description:
          'Dispare templates aprovados da API oficial para reabrir conversas e fazer comunicações ativas.',
      },
      {
        icon: 'automation',
        title: 'Robôs de automação',
        description:
          'Envie mensagens a partir de regras e robôs do Bitrix24: novo negócio, mudança de etapa, lembrete de pagamento.',
      },
      {
        icon: 'stats',
        title: 'Painel de mensagens',
        description:
          'Acompanhe o volume de mensagens enviadas e recebidas por período e por conexão.',
      },
      {
        icon: 'permissions',
        title: 'Permissões por equipe',
        description:
          'Defina quem acessa as conexões e as configurações, por usuário ou departamento.',
      },
      {
        icon: 'media',
        title: 'Áudio, imagem e documentos',
        description:
          'Mídias, respostas e edições de mensagem sincronizadas entre o WhatsApp e o chat do Bitrix24.',
      },
    ],
  },
  tutorialsSection: {
    title: 'Tutoriais',
    subtitle:
      'Simulações do caminho real, dentro do Bitrix24. Escolha um tema e clique no destaque laranja para avançar.',
  },
  player: {
    tabsLabel: 'Tutoriais',
    variantsLabel: tutorial => `Tipos de ${tutorial.toLowerCase()}`,
    done: 'Concluído',
    stepOf: (step, total) => `Passo ${step} de ${total}`,
    hint: 'Clique no destaque laranja da tela:',
    back: 'Voltar',
    next: 'Próximo',
    finish: 'Concluir',
    goToStep: (step, title) => `Ir para o passo ${step}: ${title}`,
    restart: 'Ver de novo',
    nextTutorial: label => `Próximo tutorial: ${label}`,
  },
  frame: {
    bitrixMenu: {
      crm: 'CRM',
      openChannels: 'Canais abertos',
      thinkzap: 'ThinkZap',
      market: 'Market',
    },
    appMenu: {
      home: 'Início',
      conexoes: 'Conexões',
      administracao: 'Administração',
      thinkbot: 'ThinkBot',
      logs: 'Logs',
      ajuda: 'Ajuda',
    },
    poweredBy: 'Desenvolvido por CRMThink',
    beta: 'Versão Beta',
    portalHost: 'suaempresa.bitrix24.com.br',
  },
  shared: {
    conexoesTitle: 'Configurações',
    conexoesSubtitle: 'Gerencie os números de WhatsApp conectados ao Bitrix24',
    providerLabel: { web: 'WhatsApp Web', oficial: 'Oficial' },
    activeLines: count => `Linhas ativas: ${count}`,
    tableName: 'Nome',
    tableStatus: 'Status',
    lineTabs: {
      conexao: 'Conexão',
      grupos: 'Grupos',
      templates: 'Templates',
      ajustes: 'Ajustes',
    },
    defaultLineName: 'Linha 1',
    backToConnections: '← Voltar para conexões',
    connected: 'Conectada',
    disconnected: 'Desconectada',
    webHint: 'Conecta lendo o QR code no seu celular. Mais rápido de começar.',
    oficialHint: 'Canal oficial da Meta, com número verificado e templates.',
    deal: {
      title: 'Pedido Maria Clara',
      contact: 'Maria Clara',
      value: 'R$ 2.400,00',
    },
    dealLabel: (id, value) => `Negócio #${id} · ${value}`,
    dealTabs: {
      geral: 'Geral',
      produtos: 'Produtos',
      thinkzap: 'ThinkZap',
      historico: 'Histórico',
    },
    stages: {
      novo: 'Novo',
      proposta: 'Proposta enviada',
      negociacao: 'Negociação',
      fechado: 'Fechado',
    },
    dealsTitle: 'Negócios',
    filterSearch: 'Filtro + pesquisa',
  },
  tutorials: {
    instalacao: INSTALACAO_PT,
    ativacao: ATIVACAO_PT,
    thinkbot: THINKBOT_PT,
    'api-oficial': API_OFICIAL_PT,
    robos: ROBOS_PT,
    grupos: GRUPOS_PT,
  },
  faq: {
    title: 'Dúvidas frequentes',
    items: [
      {
        question: 'Preciso de um número novo?',
        answer:
          'Não. Você pode conectar o número que já usa, pelo WhatsApp Web, ou usar um número na API oficial do WhatsApp Business.',
      },
      {
        question: 'Qual a diferença entre WhatsApp Web e API oficial?',
        answer:
          'O WhatsApp Web conecta pelo QR Code e usa o aparelho como hoje. A API oficial é o canal homologado pela Meta, com templates aprovados e envio ativo em escala. O ThinkZap trabalha com os dois.',
      },
      {
        question: 'Funciona em qualquer plano do Bitrix24?',
        answer:
          'O ThinkZap usa as linhas abertas (Contact Center) do Bitrix24. Se o seu plano tem linhas abertas, ele funciona no seu portal.',
      },
      {
        question: 'Minha equipe precisa sair do Bitrix24 para responder?',
        answer:
          'Não. As mensagens chegam no chat das linhas abertas e ficam vinculadas ao contato e ao negócio no CRM.',
      },
      {
        question: 'Consigo testar antes de contratar?',
        answer: `Sim. Depois de instalar, você ativa um teste grátis de ${THINKZAP_TRIAL_DURATION_DAYS} dias direto na tela de Conexões, sem falar com ninguém. O teste é único por instalação.`,
      },
      {
        question: 'O ThinkZap tem chatbot?',
        answer:
          'Tem. Com o ThinkBot você monta o fluxo de atendimento em blocos — perguntas, captura de dados, condições com base no CRM e transferência para um atendente —, testa no simulador e ativa em qualquer canal aberto do Bitrix24.',
        link: {
          href: '#tutorial-thinkbot',
          label: 'Ver o tutorial do ThinkBot',
        },
      },
    ],
  },
  finalCta: {
    title: 'Leve o WhatsApp para dentro do seu Bitrix24',
    subtitle:
      'Instale o ThinkZap pelo Market ou fale com nosso time para entender o melhor formato para sua operação.',
    fallback:
      'Procure o ThinkZap no Bitrix24 Market do seu portal para instalar.',
  },
  ctaButtons: {
    install: 'Instalar no Bitrix24',
    whatsapp: 'Falar no WhatsApp',
  },
  footer: year => `ThinkZap · App de WhatsApp para Bitrix24 · © ${year}`,
}
