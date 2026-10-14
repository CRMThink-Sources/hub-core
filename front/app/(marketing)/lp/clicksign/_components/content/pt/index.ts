import type { LpContent } from '../types'
import { ACOMPANHAMENTO_PT } from './tutorials/acompanhamento'
import { CONEXAO_PT } from './tutorials/conexao'
import { GRUPO_PT } from './tutorials/grupo'
import { INSTALACAO_PT } from './tutorials/instalacao'
import { NEGOCIO_PT } from './tutorials/negocio'
import { ROBO_PT } from './tutorials/robo'

export const PT: LpContent = {
  locale: 'pt',
  htmlLang: 'pt-BR',
  metadata: {
    title: 'Clicksign — Assinatura eletrônica integrada ao Bitrix24',
    description:
      'Envie documentos do Bitrix24 para assinatura na Clicksign por um robô de automação, acompanhe cada assinatura na timeline do negócio e receba o PDF assinado de volta.',
    ogLocale: 'pt_BR',
  },
  whatsappMessage:
    'Olá! Vim pela página da integração Clicksign e quero saber mais sobre assinar documentos pelo Bitrix24.',
  nav: {
    features: 'Funcionalidades',
    tutorials: 'Tutoriais',
    faq: 'Dúvidas',
    install: 'Instalar',
  },
  languageSwitch: { label: 'Idioma' },
  hero: {
    eyebrow: 'Clicksign dentro do Bitrix24',
    title: 'Contrato assinado sem sair do negócio',
    subtitle:
      'Quando o negócio chega na etapa certa, o documento vai sozinho para a Clicksign. Quem assina recebe o convite, e o PDF assinado volta para o Bitrix24.',
  },
  signPreview: {
    document: 'Contrato de serviço.pdf',
    sentFrom: 'Enviado pelo robô na etapa Contrato',
    deal: 'Negócio · Plano anual',
    signers: [
      { name: 'Maria Clara', signed: true },
      { name: 'Paulo Henrique', signed: true },
      { name: 'Lívia Torres', signed: false },
    ],
    signed: 'assinado',
    waiting: 'aguardando',
    signedFile: 'Arquivo Assinado anexado',
  },
  features: {
    title: 'Da etapa do funil ao contrato assinado',
    subtitle:
      'Configure uma vez e deixe cada negócio enviar o próprio documento para assinatura.',
    items: [
      {
        icon: 'robot',
        title: 'Envio pelo robô do Bitrix24',
        description:
          'O documento sai sozinho quando o negócio entra na etapa que você escolher, pelo robô Enviar documento.',
      },
      {
        icon: 'mapping',
        title: 'Campos do seu Negócio',
        description:
          'Você escolhe de qual campo sai o documento e onde gravar o ID, o status, a data e o PDF assinado.',
      },
      {
        icon: 'groups',
        title: 'Grupos de assinatura',
        description:
          'Um grupo para cada tipo de documento, com os contatos do negócio e pessoas da sua equipe, na ordem que você definir.',
      },
      {
        icon: 'auth',
        title: 'Verificação de quem assina',
        description:
          'Código por e-mail, SMS ou WhatsApp e, se quiser, selfie, documento oficial, assinatura manuscrita ou biometria facial.',
      },
      {
        icon: 'timeline',
        title: 'Acompanhamento na timeline',
        description:
          'Um card no negócio mostra quem já assinou e é atualizado a cada assinatura.',
      },
      {
        icon: 'signedFile',
        title: 'PDF assinado no negócio',
        description:
          'Quando todos assinam, o documento final é anexado ao negócio sozinho.',
      },
      {
        icon: 'companies',
        title: 'Várias contas Clicksign',
        description:
          'Cadastre mais de uma empresa e escolha em cada robô por qual conta enviar.',
      },
      {
        icon: 'cancel',
        title: 'Recusa e cancelamento',
        description:
          'Permita recusar com motivo e cancele um envio direto do card, com tudo registrado na timeline.',
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
      app: 'ClickSign',
      market: 'Market',
    },
    appMenu: {
      configuracoes: 'Configurações',
      assinatura: 'Grupos de assinatura',
      logs: 'Logs',
      ajuda: 'Ajuda',
    },
    poweredBy: 'Desenvolvido por CRMThink',
    beta: 'Versão Beta',
    portalHost: 'suaempresa.bitrix24.com.br',
  },
  shared: {
    select: 'Selecione…',
    configuracoes: {
      tabPrincipal: 'Principal',
      tabExtra: 'Extra',
      companiesTitle: 'Configurações de Empresas',
      companiesDescription:
        'Gerencie as configurações de integração com a Clicksign',
      newCompany: 'Nova Empresa',
      tokenLabel: 'Token de Acesso',
      tokenHint: 'Token de autenticação da API Clicksign',
      tokenPlaceholder: 'Cole o token da Clicksign',
      environmentLabel: 'Ambiente',
      environmentHint: 'Ambiente de integração com a Clicksign',
      environments: { prod: 'Produção', sandbox: 'Sandbox' },
      reminderLabel: 'Lembrete Automático',
      reminderHint: 'Frequência dos lembretes de assinatura',
      reminderDays: days => (days === 1 ? '1 dia' : `${days} dias`),
      save: 'Salvar',
      additionalTitle: 'Configurações Adicionais',
      extras: {
        selfie: 'Utilizar Selfie como autenticação',
        facialBiometrics:
          'Utilizar biometria facial como ponto de autenticação adicional para o signatário',
        handwritten:
          'Utilizar assinatura manuscrita como ponto de autenticação no momento da assinatura',
        officialDocument:
          'Solicitar a foto (frente e verso) do documento oficial',
        rubrica: 'Solicitar rubrica (necessário ativar função de envelope)',
      },
      facialBiometricsHint:
        'Custo adicional de R$ 1,50 por biometria facial realizada com sucesso (cobrado pela Clicksign).',
      contactFieldsTitle: 'Campos de Contato',
      contactFieldsDescription:
        'Este mapeamento é obrigatório quando o signatário do grupo de assinatura for o "Contato padrão" do negócio.',
      cpfLabel: 'CPF',
      isForeignLabel: 'É estrangeiro?',
      signAsLabel: 'Assinar como',
      signAsValue: '[Clicksign] Assinar como',
      signAsHint: 'Campo criado na instalação do APP (não excluir)',
    },
    assinatura: {
      title: 'Configuração de Assinaturas',
      description:
        'Configure os grupos de assinatura e seus respectivos campos no Bitrix24',
      save: 'Salvar',
      newGroup: 'Novo Grupo',
      empty: 'Nenhum grupo de assinatura. Clique em “Novo Grupo” para começar.',
      group: 'Grupo',
      groupIdPlaceholder: 'Identificador do grupo',
      dealFields: 'Campos do Negócio',
      fields: {
        arquivo: {
          label: 'Arquivo para Assinatura',
          hint: 'Campo que contém o arquivo a ser assinado',
        },
        dataLimite: {
          label: 'Data Limite',
          hint: 'Data limite para assinatura do documento',
        },
        documentoId: {
          label: 'ID do Documento',
          hint: 'Campo para armazenar o ID do documento na Clicksign',
        },
        status: {
          label: 'Status de Assinatura',
          hint: 'Campo que indica se o documento foi assinado',
        },
        finalizado: {
          label: 'Processo Finalizado',
          hint: 'Campo que indica se o processo de assinatura foi concluído',
        },
        dataAssinatura: {
          label: 'Data de Assinatura',
          hint: 'Data em que o documento foi assinado',
        },
        arquivoAssinado: {
          label: 'Arquivo Assinado',
          hint: 'Campo onde será salvo o documento assinado',
        },
      },
      contactsTitle: 'Configuração de Contatos',
      addContact: 'Adicionar Contato',
      participantsTitle: 'Participantes',
      add: 'Adicionar',
      useDefaultContact: 'Usar contato padrão do negócio',
      useDefaultContactHint:
        'Se desativado, você pode selecionar campos personalizados',
      userLabel: 'Usuário',
      userHint: 'Selecione um usuário fixo ou use um campo do Bitrix',
      roleLabel: 'Função',
      emailLabel: 'Email',
      emailPlaceholder: 'Email do participante',
      isForeign: 'É estrangeiro',
    },
    crm: {
      dealsTitle: 'Negócios',
      filterSearch: 'Filtro e pesquisa',
      stages: {
        novo: 'Novo',
        proposta: 'Proposta enviada',
        contrato: 'Contrato',
        ganho: 'Negócio fechado',
      },
      fieldKinds: { file: 'Arquivo', date: 'Data', text: 'Texto' },
      dealLabel: (id, value) => `Negócio #${id} · ${value}`,
      about: 'Sobre o negócio',
      timeline: 'Timeline',
      empty: 'não preenchido',
    },
    card: {
      title: '[Clicksign]',
      intro: 'Documento enviado para assinatura',
      header: (documentId, group) => `Documento ${documentId} - ${group}`,
      canceledHeader: documentId => `Documento ${documentId}`,
      status: {
        progress: 'Em andamento',
        finished: 'Finalizado',
        refused: 'Recusado',
        canceled: 'Cancelado',
      },
      signer: {
        waiting: 'Aguardando',
        signed: 'Assinado',
        refused: 'Recusado',
      },
      cancel: 'Cancelar documento',
    },
    sample: {
      companyName: 'Acme Ltda',
      companyDraft: 'Nova Empresa',
      token: 'a3f1c9e2-7b4d-4e8a-9c21-5d6e0f7a8b90',
      groupId: 'Contrato de serviço',
      documentId: '8e2b…41f0',
      deal: {
        title: 'Plano anual',
        contact: 'Maria Clara',
        value: 'R$ 12.000,00',
      },
      // Participantes vêm antes dos contatos (`build-signers.ts`).
      signers: [
        { name: 'Ana Souza', email: 'ana@suaempresa.com' },
        { name: 'Maria Clara', email: 'maria@cliente.com' },
      ],
      user: 'Ana Souza',
      role: 'Assinar como contratante',
      fileName: 'contrato-servico.pdf',
      signedFileName: 'contrato-servico-assinado.pdf',
      signedAt: '14/10/2026',
      yes: 'Sim',
      cpfField: 'CPF',
      foreignField: 'Estrangeiro',
    },
  },
  tutorials: {
    instalacao: INSTALACAO_PT,
    conexao: CONEXAO_PT,
    negocio: NEGOCIO_PT,
    grupo: GRUPO_PT,
    robo: ROBO_PT,
    acompanhamento: ACOMPANHAMENTO_PT,
  },
  faq: {
    title: 'Dúvidas frequentes',
    items: [
      {
        question:
          'Apareceu "Documento não anexado ao negócio" ou "Não foi possível baixar o arquivo anexado". O que faço?',
        answer:
          'O robô não achou o documento no negócio. Anexe o arquivo no campo escolhido em Arquivo para Assinatura do grupo — vale só o primeiro arquivo, em PDF, DOC, DOCX, PNG ou JPG. Se o arquivo já estava lá, anexe de novo. Depois rode o robô outra vez, tirando o negócio da etapa e voltando.',
        link: {
          href: '#tutorial-grupo',
          label: 'Ver o tutorial do grupo de assinatura',
        },
      },
      {
        question:
          'Apareceu "Nenhum signatário encontrado para o grupo selecionado".',
        answer:
          'O grupo não achou ninguém para assinar. Confira se os campos de nome e e-mail de quem assina estão preenchidos no negócio e se o grupo aponta para os campos certos. Com "Usar contato padrão do negócio" ligado, o negócio precisa ter pelo menos um contato vinculado. Corrija e rode o robô de novo.',
        link: {
          href: '#tutorial-grupo',
          label: 'Ver o tutorial do grupo de assinatura',
        },
      },
      {
        question: 'O robô rodou e nada aconteceu. O grupo sumiu?',
        answer:
          'Se o grupo foi renomeado ou apagado, o robô continua apontando para o antigo e o envio para sem aviso na timeline — o motivo fica em Logs, no app. Em Grupos de assinatura, clique em Salvar, abra o robô no Bitrix24 e escolha o grupo de novo.',
        link: {
          href: '#tutorial-robo',
          label: 'Ver o tutorial do robô de envio',
        },
      },
      {
        question: 'Troquei a empresa ou o token e o envio parou.',
        answer:
          'O robô guarda a empresa que foi escolhida nele. Depois de trocar o token ou remover a empresa, salve as Configurações, abra o robô e escolha a Empresa de novo.',
        link: {
          href: '#tutorial-robo',
          label: 'Ver o tutorial do robô de envio',
        },
      },
      {
        question: 'A Clicksign recusou o envio. Por quê?',
        answer:
          'A mensagem da Clicksign aparece num comentário [Clicksign] na timeline do negócio e em Logs, no app. As causas mais comuns são token inválido ou vencido, token de um ambiente com o outro escolhido em Ambiente (Produção × Sandbox) e limites da sua conta na Clicksign. Corrija em Configurações, salve e rode o robô de novo.',
        link: {
          href: '#tutorial-conexao',
          label: 'Ver o tutorial de conexão com a Clicksign',
        },
      },
      {
        question:
          'O documento foi assinado, mas o status não volta para o Bitrix24.',
        answer:
          'Em Configurações, confira se o token e o Ambiente estão certos e clique em Salvar de novo: ao salvar, o app religa sozinho o retorno de status da Clicksign. Não é preciso configurar nada no painel da Clicksign.',
        link: {
          href: '#tutorial-conexao',
          label: 'Ver o tutorial de conexão com a Clicksign',
        },
      },
      {
        question: 'Todos assinaram, mas o PDF não foi anexado ao negócio.',
        answer:
          'O app tenta de novo sozinho por um tempo. Confira se o campo escolhido em Arquivo Assinado é do tipo arquivo e se o documento tem até 25 MB. Acima disso, baixe o PDF assinado no painel da Clicksign e anexe ao negócio à mão.',
        link: {
          href: '#tutorial-acompanhamento',
          label: 'Ver o tutorial de acompanhamento',
        },
      },
      {
        question: 'Não consegui cancelar o documento.',
        answer:
          'Documento já assinado por todos, finalizado ou expirado não pode ser cancelado, e a timeline mostra um comentário com o motivo. Confira como ele está no painel da Clicksign. Se foi uma falha passageira, clique em Cancelar documento de novo.',
      },
      {
        question:
          'O negócio muda de etapa sozinho quando o documento é assinado?',
        answer:
          'Não. O app preenche Status de Assinatura, Data de Assinatura, Processo Finalizado e Arquivo Assinado no negócio. Para mover o negócio, crie a sua própria automação no Bitrix24 a partir da mudança desses campos.',
        link: {
          href: '#tutorial-acompanhamento',
          label: 'Ver o tutorial de acompanhamento',
        },
      },
      {
        question: 'O robô rodou antes de eu salvar as Configurações.',
        answer:
          'Sem empresa e token salvos, o robô não tem por qual conta enviar e nada vai para a Clicksign. Cadastre a empresa em Configurações, salve, monte o grupo de assinatura e rode o robô de novo.',
        link: {
          href: '#tutorial-conexao',
          label: 'Ver o tutorial de conexão com a Clicksign',
        },
      },
    ],
  },
  finalCta: {
    title: 'Assine contratos sem sair do Bitrix24',
    subtitle:
      'Instale a integração com a Clicksign pelo Market ou fale com nosso time para montar o fluxo de assinatura da sua operação.',
    fallback:
      'Procure a Clicksign no Bitrix24 Market do seu portal para instalar.',
  },
  ctaButtons: {
    install: 'Instalar no Bitrix24',
    whatsapp: 'Falar no WhatsApp',
  },
  footer: year => `Clicksign · Assinatura eletrônica para Bitrix24 · © ${year}`,
}
