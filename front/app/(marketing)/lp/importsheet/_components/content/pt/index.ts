import type { LpContent } from '../types'
import { AGENDAMENTO_PT } from './tutorials/agendamento'
import { ERROS_PT } from './tutorials/erros'
import { GOOGLE_PT } from './tutorials/google'
import { INSTALACAO_PT } from './tutorials/instalacao'
import { MAPEAMENTO_PT } from './tutorials/mapeamento'
import { NOVA_IMPORTACAO_PT } from './tutorials/nova-importacao'

export const PT: LpContent = {
  locale: 'pt',
  htmlLang: 'pt-BR',
  metadata: {
    title: 'ImportSheet — Google Sheets integrado ao Bitrix24',
    description:
      'Importe planilhas do Google Sheets para o Bitrix24: leads, negócios, contatos, empresas, SPAs, tarefas e Livefeed, com de-para de colunas, agendamento e sem registros duplicados.',
    ogLocale: 'pt_BR',
  },
  whatsappMessage:
    'Olá! Vim pela página do ImportSheet e quero saber mais sobre importar planilhas do Google para o Bitrix24.',
  nav: {
    features: 'Funcionalidades',
    tutorials: 'Tutoriais',
    faq: 'Dúvidas',
    install: 'Instalar',
  },
  languageSwitch: { label: 'Idioma' },
  hero: {
    eyebrow: 'Google Sheets dentro do Bitrix24',
    title: 'Sua planilha do Google vira registro no CRM, sem copiar e colar',
    subtitle:
      'O ImportSheet lê as linhas da sua planilha e cria ou atualiza leads, negócios, contatos, empresas e SPAs no Bitrix24 — na hora ou no horário que você agendar.',
  },
  sheetPreview: {
    columns: ['Pedido', 'Cliente', 'Valor'],
    rows: [
      ['1042', 'Maria Clara', 'R$ 2.400'],
      ['1043', 'Paulo Henrique', 'R$ 980'],
      ['1044', 'Lívia Torres', 'R$ 5.150'],
    ],
    entity: 'Negócios',
    created: 'criado',
    updated: 'atualizado',
  },
  features: {
    title: 'Da planilha ao CRM, sem retrabalho',
    subtitle:
      'Configure uma vez e deixe as linhas novas chegarem sozinhas ao Bitrix24.',
    items: [
      {
        icon: 'sheets',
        title: 'Direto do Google Sheets',
        description:
          'Cole o link da planilha, escolha a aba e pronto. O ImportSheet só lê — a sua planilha continua do jeito que está.',
      },
      {
        icon: 'entities',
        title: 'Todas as entidades do CRM',
        description:
          'Leads, negócios (com pipeline), contatos, empresas, SPAs e tarefas. E comentários no Livefeed de registros que já existem.',
      },
      {
        icon: 'mapping',
        title: 'De-para coluna a coluna',
        description:
          'Ligue cada coluna a um campo do Bitrix24, inclusive campos personalizados, e crie o contato e a empresa na mesma linha.',
      },
      {
        icon: 'dedup',
        title: 'Sem registros duplicados',
        description:
          'Marque uma coluna como identificador: se o registro já existe, ele é atualizado em vez de duplicado.',
      },
      {
        icon: 'schedule',
        title: 'Agendamento',
        description:
          'Rode a cada X horas, em dias da semana escolhidos ou só quando quiser, com um clique.',
      },
      {
        icon: 'incremental',
        title: 'Só as linhas novas',
        description:
          'Cada rodada continua de onde a anterior parou. Se o Bitrix24 pedir uma pausa, a importação espera e retoma sozinha.',
      },
      {
        icon: 'errors',
        title: 'Erros por linha',
        description:
          'Veja qual linha falhou e por quê, corrija a planilha e reprocesse só o que deu erro.',
      },
      {
        icon: 'notify',
        title: 'Avisos de erro',
        description:
          'Escolha quem recebe uma notificação no Bitrix24 quando uma importação terminar com erros.',
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
      app: 'ImportSheet',
      market: 'Market',
    },
    appMenu: {
      importacoes: 'Importações',
      configuracoes: 'Configurações',
      logs: 'Logs',
      ajuda: 'Ajuda',
    },
    poweredBy: 'Desenvolvido por CRMThink',
    beta: 'Versão Beta',
    portalHost: 'suaempresa.bitrix24.com.br',
  },
  shared: {
    importacoes: {
      title: 'Importações',
      subtitle: 'Área de trabalho de importações',
      newImport: 'Nova importação',
      emptyBefore: 'Nenhuma importação ainda. Clique em',
      emptyAfter: 'para começar.',
    },
    lista: {
      manual: 'Manual',
      everyHours: hours => `A cada ${hours}h`,
      run: 'Executar',
      running: 'Em execução',
      scheduleActive: 'Agendamento ativo',
      schedulePaused: 'Agendamento pausado',
      pauseSchedule: 'Pausar agendamento',
      edit: 'Editar',
      lastRun: when => `Última execução: ${when}`,
      neverRun: 'Nunca executada',
      viewErrors: 'Ver erros',
    },
    configuracoes: {
      title: 'Configurações',
      subtitle: 'Integrações e conexões do app',
      googleConnection: 'Conexão Google',
      connected: 'Conectado',
      noAccount: 'Nenhuma conta Google conectada.',
      connectGoogle: 'Conectar com Google',
      disconnect: 'Desconectar',
      success: 'Conta Google conectada com sucesso.',
      closeNotice: 'Fechar aviso',
      notifyTitle: 'Notificações de erro',
      notifyDescription:
        'Usuários que receberão uma notificação quando uma importação for concluída com erros.',
      selectedCount: count => `${count} selecionado(s)`,
      recipients: 'Destinatários',
      clearAll: 'Limpar todos',
      noneSelected: 'Nenhum destinatário selecionado ainda.',
      searchUser: 'Buscar usuário…',
      unsaved: 'Alterações não salvas',
      allSaved: 'Tudo salvo',
      save: 'Salvar',
    },
    configure: {
      title: 'Configurar importação',
      description: 'Defina o destino no Bitrix24 e o mapeamento das colunas',
      back: 'Voltar',
      cancel: 'Cancelar',
      save: 'Salvar',
      identity: {
        name: 'Nome da importação',
        spreadsheet: 'Planilha',
        tab: 'Selecionar aba',
        startRow: 'Importar a partir da linha',
        startRowHint: 'A linha 01 contém os cabeçalhos da planilha.',
      },
      destination: { entity: 'Entidade', pipeline: 'Pipeline' },
      entities: {
        LEAD: 'Lead',
        DEAL: 'Negócio',
        CONTACT: 'Contato',
        COMPANY: 'Empresa',
        SPA: 'SPA',
        TASK: 'Tarefas',
        FEED: 'Livefeed',
      },
      responsible: {
        column: 'Responsável (coluna)',
        matchBy: 'Responsável identificado por',
      },
      match: { id: 'ID', email: 'E-mail', phone: 'Telefone' },
      options: {
        createContact: 'Criar contato',
        createCompany: 'Criar empresa',
      },
      schedule: {
        title: 'Agendamento',
        frequency: 'Frequência',
        everyHours: 'A cada (horas)',
        weekdays: 'Dias da semana',
        manual: 'Executar importação manualmente',
        frequencyOptions: { hours: 'Horas', days: 'Dias da semana' },
        weekdayLabels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      },
      mapping: {
        title: 'Mapeamento de colunas',
        description:
          'Associe as colunas da sua planilha aos campos do Bitrix24.',
        counter: (mapped, total) => `${mapped} de ${total} mapeadas`,
        column: 'Coluna',
        destination: 'Destino',
        field: 'Campos no Bitrix',
        identifier: 'Identificador',
        actions: 'Ações',
        useAsIdentifier: 'Usar como identificador',
        removeColumn: 'Remover coluna',
        destinations: { contact: 'Contato', company: 'Empresa' },
        fieldTypes: {
          lista: 'lista',
          data: 'data',
          sn: 'S/N',
          moeda: 'R$',
          contato: 'contato',
        },
      },
    },
    sample: {
      importTitle: 'Pedidos da loja',
      spreadsheetName: 'Loja online 2026',
      spreadsheetId: '1AbC9xZ…',
      tab: 'Pedidos',
      pipeline: 'Vendas',
      columns: [
        { letter: 'A', label: 'Pedido', target: 'main', field: 'Nº do pedido' },
        { letter: 'B', label: 'Cliente', target: 'contact', field: 'Nome' },
        {
          letter: 'C',
          label: 'E-mail',
          target: 'contact',
          field: 'E-mail',
          type: 'contato',
        },
        {
          letter: 'D',
          label: 'Valor',
          target: 'main',
          field: 'Oportunidade',
          type: 'moeda',
        },
        {
          letter: 'E',
          label: 'Etapa',
          target: 'main',
          field: 'Fase',
          type: 'lista',
        },
        { letter: 'F', label: 'Vendedor', target: 'main', field: 'Vendedor' },
      ],
      googleEmail: 'voce@empresa.com',
      lastRunWhen: '13/10/2026 09:00',
      manualImportTitle: 'Cadastro de empresas',
      manualSpreadsheetName: 'Empresas parceiras',
    },
  },
  tutorials: {
    instalacao: INSTALACAO_PT,
    google: GOOGLE_PT,
    'nova-importacao': NOVA_IMPORTACAO_PT,
    mapeamento: MAPEAMENTO_PT,
    agendamento: AGENDAMENTO_PT,
    erros: ERROS_PT,
  },
  faq: {
    title: 'Dúvidas frequentes',
    items: [
      {
        question: 'A planilha não foi encontrada ao validar. O que faço?',
        answer:
          'Confira se o link ou ID colado é o da planilha certa — compare com o endereço do navegador com a planilha aberta. Depois, no Google Sheets, compartilhe a planilha (basta leitura) com o e-mail da conta Google conectada em Configurações. Se a planilha for de outra conta, conecte essa conta no lugar.',
        link: {
          href: '#tutorial-nova-importacao',
          label: 'Ver o tutorial de nova importação',
        },
      },
      {
        question: 'A conexão com o Google caiu. Como reconecto?',
        answer:
          'Em Configurações, clique em Conectar com Google e escolha, na janela do Google, a conta que tem acesso às planilhas. Isso acontece quando o acesso é removido na própria conta Google ou expira. Depois de reconectar, rode a importação de novo.',
        link: {
          href: '#tutorial-google',
          label: 'Ver o tutorial de conexão com o Google',
        },
      },
      {
        question: 'Posso renomear ou apagar a aba da planilha?',
        answer:
          'Renomear pode: a importação acompanha a aba mesmo com nome novo. Apagar, não — sem a aba a importação para de rodar. Se isso acontecer, clique em Editar na importação, escolha a aba certa em Selecionar aba e salve.',
      },
      {
        question: 'Por que não aparece nenhuma coluna para mapear?',
        answer:
          'Os títulos das colunas precisam estar na linha 1 da aba escolhida. Se essa linha estiver vazia, não há colunas para o de-para. Confira se a aba é a certa e coloque os títulos na primeira linha.',
      },
      {
        question:
          'A linha foi importada, mas um campo ficou em branco. Por quê?',
        answer:
          'Campos de lista do Bitrix24 (como fase, origem ou listas personalizadas) só aceitam uma opção que já existe. Se o texto da planilha não for exatamente igual a uma opção — um acento, uma maiúscula ou um espaço a mais —, esse campo é ignorado sem aviso e o resto da linha é importado normalmente. Iguale o texto à opção ou crie a opção no Bitrix24. Para reenviar essas linhas, edite a importação e volte "Importar a partir da linha" até elas; com o identificador marcado, os registros são atualizados em vez de duplicados.',
      },
      {
        question: 'Como o ImportSheet evita registros duplicados?',
        answer:
          'Pela coluna marcada como identificador. Se o valor bate com um registro, ele é atualizado; se não bate com nenhum, é criado; se bate com mais de um, a linha não é importada e aparece nos erros. Nesse caso, junte ou remova os duplicados no Bitrix24 (ou escolha uma coluna realmente única) e reprocesse a linha.',
        link: {
          href: '#tutorial-mapeamento',
          label: 'Ver o tutorial de mapeamento',
        },
      },
      {
        question: 'O responsável do registro não é o que estava na planilha.',
        answer:
          'A coluna de responsável precisa trazer o ID, o e-mail ou o telefone (o que você escolheu em "Responsável identificado por") de um usuário ativo do Bitrix24. Se não achar o usuário, a linha é importada mesmo assim, com o responsável padrão. Corrija o valor na planilha e ajuste o responsável dos registros que já entraram.',
      },
      {
        question: 'A importação lê a planilha inteira toda vez?',
        answer:
          'Não. Cada rodada continua de onde a anterior parou e lê só as linhas novas, adicionadas no fim. Linhas já importadas que você alterar depois não são lidas de novo. Se o Bitrix24 estiver sobrecarregado, a rodada pausa e retoma sozinha do mesmo ponto.',
        link: {
          href: '#tutorial-agendamento',
          label: 'Ver o tutorial de agendamento',
        },
      },
      {
        question: 'Minha importação agendada parou de rodar.',
        answer:
          'Ela pode estar pausada: por alguém, na chave da lista, ou automaticamente depois de um erro que interrompeu a rodada. Abra Ver erros, resolva a causa e ligue de novo a chave do agendamento. Quem estiver em Notificações de erro recebe um aviso quando isso acontece.',
        link: {
          href: '#tutorial-erros',
          label: 'Ver o tutorial de erros e reprocessamento',
        },
      },
    ],
  },
  finalCta: {
    title: 'Leve suas planilhas para dentro do Bitrix24',
    subtitle:
      'Instale o ImportSheet pelo Market ou fale com nosso time para entender o melhor formato para a sua operação.',
    fallback:
      'Procure o ImportSheet no Bitrix24 Market do seu portal para instalar.',
  },
  ctaButtons: {
    install: 'Instalar no Bitrix24',
    whatsapp: 'Falar no WhatsApp',
  },
  footer: year => `ImportSheet · Google Sheets para Bitrix24 · © ${year}`,
}
