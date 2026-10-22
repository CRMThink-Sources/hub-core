import type { HomeContent } from './types'

export const pt: HomeContent = {
  locale: 'pt',
  htmlLang: 'pt-BR',
  metadata: {
    title: 'Think Hub — Apps da CRMThink para Bitrix24',
    description:
      'WhatsApp, assinatura eletrônica, importação de planilhas, BI e agentes de IA dentro do seu Bitrix24. Conheça os apps do Think Hub.',
    ogLocale: 'pt_BR',
  },
  languageSwitch: { label: 'Idioma' },
  nav: { apps: 'Apps', why: 'Por que o Think Hub', cta: 'Ver os apps' },
  hero: {
    eyebrow: 'Apps da CRMThink para Bitrix24',
    title: 'Tudo o que o seu Bitrix24 ainda não faz,',
    highlight: 'conectado em um só lugar',
    subtitle:
      'O Think Hub reúne os apps da CRMThink: WhatsApp no canal aberto, contratos assinados no negócio, planilhas importadas para o CRM, dados externos no BI e agentes de IA atendendo seus clientes.',
    primary: 'Conhecer os apps',
    secondary: 'Por que o Think Hub',
    diagramLabel: 'Os apps do Think Hub conectados ao Bitrix24',
  },
  apps: {
    title: 'Escolha o app para o seu desafio',
    subtitle:
      'Cada app resolve uma parte do processo e funciona dentro do Bitrix24 — sem trocar de tela.',
    learnMore: name => `Conhecer o ${name}`,
    comingSoon: 'Página em breve',
    items: {
      thinkzap: {
        tagline: 'WhatsApp dentro do Bitrix24',
        description:
          'Atenda pelo WhatsApp nos canais abertos e dispare mensagens pelos robôs do CRM.',
        highlights: [
          'API oficial e WhatsApp Web',
          'Templates e mensagens com botões',
          'Envio pelos robôs do funil',
        ],
      },
      clicksign: {
        tagline: 'Assinatura eletrônica no negócio',
        description:
          'Gere e envie contratos para assinatura direto da etapa do funil e acompanhe tudo na timeline.',
        highlights: [
          'Documento com os campos do negócio',
          'Grupos e ordem de assinatura',
          'PDF assinado de volta no CRM',
        ],
      },
      importsheet: {
        tagline: 'Planilhas direto para o CRM',
        description:
          'Importe planilhas do Google para o Bitrix24 com mapeamento de campos e agendamento.',
        highlights: [
          'Conexão com o Google Sheets',
          'Mapeamento de colunas para campos',
          'Importações agendadas',
        ],
      },
      thinkanalise: {
        tagline: 'Dados externos no BI do Bitrix24',
        description:
          'Conecte APIs de outros sistemas e leve os dados para datasets do BI Builder.',
        highlights: [
          'Conexões de API configuráveis',
          'Datasets no BI Builder',
          'Logs de cada sincronização',
        ],
      },
      gptmaker: {
        tagline: 'Agentes de IA no atendimento',
        description:
          'Coloque um agente de IA para atender nos canais abertos, consultar o CRM e transferir para humanos.',
        highlights: [
          'Atendimento nos canais abertos',
          'Consulta e registro no CRM',
          'Transferência para o operador',
        ],
      },
    },
  },
  why: {
    title: 'Por que o Think Hub',
    subtitle:
      'Apps pensados para quem já vive no Bitrix24 e não quer mais uma ferramenta para abrir.',
    items: [
      {
        icon: 'bitrix',
        title: 'Dentro do Bitrix24',
        description:
          'Os apps aparecem no CRM, nos canais abertos e nos robôs que a sua equipe já usa.',
      },
      {
        icon: 'market',
        title: 'Instalação pelo Market',
        description:
          'Instale pelo Bitrix24 Market e configure em poucos passos, com tutoriais em cada página.',
      },
      {
        icon: 'support',
        title: 'Feito por parceiro Bitrix24',
        description:
          'Desenvolvido e mantido pela CRMThink, com suporte de quem implanta Bitrix24 todos os dias.',
      },
      {
        icon: 'languages',
        title: 'Português, inglês e espanhol',
        description:
          'Interfaces e conteúdos nos idiomas da sua operação, no Brasil e fora dele.',
      },
    ],
  },
  finalCta: {
    title: 'Comece pelo app que mais faz falta hoje',
    subtitle:
      'Cada app tem uma página com funcionalidades, tutoriais e o link de instalação.',
    button: 'Ver os apps',
  },
  footer: year => `© ${year} CRMThink. Todos os direitos reservados.`,
}
