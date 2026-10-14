import type { InstalacaoCopy } from '../../pt/tutorials/instalacao'

export const INSTALACAO_ES: InstalacaoCopy = {
  tutorial: {
    slug: 'instalacao',
    label: 'Instalación',
    summary: 'Del Bitrix24 Market a la app instalada en su portal.',
    steps: [
      {
        screen: 'market',
        title: 'Encuentre ImportSheet en el Market',
        description:
          'En su Bitrix24, abra el Market, busque ImportSheet y haga clic en la tarjeta de la app.',
        action: 'ImportSheet',
      },
      {
        screen: 'market-app',
        title: 'Instale desde la página de la app',
        description:
          'La página de ImportSheet se abre sobre el catálogo, con el desarrollador (CRMThink) y la categoría. Haga clic en Instalar.',
        action: 'Instalar',
      },
      {
        screen: 'install',
        title: 'Acepte los términos y finalice',
        description:
          'En la pantalla de instalación, acepte los términos de Bitrix24 Market. El correo es opcional.',
        action: 'Finalizar instalación',
      },
    ],
    done: {
      title: 'ImportSheet instalado',
      description:
        'La app ya está en el menú de su Bitrix24. El siguiente paso es conectar la cuenta de Google que tiene acceso a sus hojas de cálculo.',
    },
  },
  screens: {
    market: {
      appTagline: 'Importe hojas de Google Sheets al CRM de Bitrix24',
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
