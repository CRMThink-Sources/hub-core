import type { InstalacaoCopy } from '../../pt/tutorials/instalacao'

export const INSTALACAO_ES: InstalacaoCopy = {
  tutorial: {
    slug: 'instalacao',
    label: 'Instalación',
    summary: 'Del Bitrix24 Market a la app instalada en tu portal.',
    steps: [
      {
        screen: 'market',
        title: 'Encuentra Clicksign en el Market',
        description:
          'En tu Bitrix24, abre el Market, busca Clicksign y haz clic en la tarjeta de la app.',
        action: 'Clicksign',
      },
      {
        screen: 'market-app',
        title: 'Instala desde la página de la app',
        description:
          'La página de Clicksign se abre sobre el catálogo, con el desarrollador (CRMThink) y la categoría. Haz clic en Instalar.',
        action: 'Instalar',
      },
      {
        screen: 'install',
        title: 'Acepta los términos y finaliza',
        description:
          'En la pantalla de instalación, acepta los términos de Bitrix24 Market. El correo es opcional. La instalación ya crea el robot Enviar documento y el campo "[Clicksign] Firmar como" en el contacto.',
        action: 'Finalizar instalación',
      },
    ],
    done: {
      title: 'Clicksign instalada',
      description:
        'La app ya está en el menú de tu Bitrix24. El siguiente paso es conectar tu cuenta de Clicksign.',
    },
  },
  screens: {
    market: {
      appTagline: 'Firma electrónica de Clicksign integrada al CRM de Bitrix24',
      appCategory: 'CRM',
      appsCount: '830+ aplicaciones',
      catalog: 'Catálogo',
      scope: 'Todo el Market',
      favorites: 'Favoritos',
      more: 'Más',
      searchResults: 'Resultados de búsqueda',
      seeAll: 'Todas',
      install: 'Instalar',
      rating: 'Valoración',
      installs: 'Instalaciones',
      developer: 'Desarrollador',
      category: 'Categoría',
      description: 'Descripción',
    },
    install: {
      title: 'Instalación de la aplicación',
      subtitle: 'Complete los datos y acepte los términos para finalizar.',
      emailLabel: 'Correo electrónico de instalación (opcional)',
      emailPlaceholder: 'tu@empresa.com',
      termsTitle: 'Términos y aceptación',
      accept: 'He leído y acepto',
      terms: [
        'Términos de uso de Bitrix24 Market',
        'Contrato de licencia (EULA)',
        'Política de privacidad',
      ],
      submit: 'Finalizar instalación',
    },
  },
}
