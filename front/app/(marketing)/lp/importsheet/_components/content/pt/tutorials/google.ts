import type { Tutorial, GoogleScreen } from '../../types'

const tutorial: Tutorial<GoogleScreen> = {
  slug: 'google',
  label: 'Conectar Google',
  summary:
    'A conta Google conectada é quem abre as planilhas: conecte uma que tenha acesso a elas.',
  steps: [
    {
      screen: 'settings',
      title: 'Conecte a conta em Configurações',
      description:
        'No menu do app, abra Configurações. O card Conexão Google mostra que nenhuma conta está conectada — enquanto isso, o botão Nova importação fica bloqueado. Clique em Conectar com Google.',
      action: 'Conectar com Google',
    },
    {
      screen: 'consent',
      title: 'Autorize no Google',
      description:
        'Abre uma janela do próprio Google. Escolha a conta que tem acesso às planilhas e permita a leitura. O ImportSheet só lê — nunca altera a sua planilha.',
      action: 'Continuar',
    },
    {
      screen: 'connected',
      title: 'Conta conectada',
      description:
        'O card passa a mostrar Conectado e o e-mail da conta. As planilhas que você for importar precisam estar compartilhadas com esse e-mail.',
      action: 'Conectado',
    },
  ],
  done: {
    title: 'Google conectado',
    description:
      'O aviso some de Importações e o botão Nova importação fica liberado. Agora é escolher a planilha.',
  },
}

const screens = {
  consent: {
    signIn: 'Fazer login com o Google',
    heading: 'ImportSheet quer acessar sua Conta do Google',
    allow: 'Isso permitirá que o ImportSheet:',
    scopes: [
      'Ver todas as suas planilhas do Google Sheets',
      'Ver e baixar todos os seus arquivos do Google Drive',
    ],
    cancel: 'Cancelar',
    proceed: 'Continuar',
  },
}

export type GoogleCopy = {
  tutorial: Tutorial<GoogleScreen>
  screens: typeof screens
}

export const GOOGLE_PT: GoogleCopy = { tutorial, screens }
