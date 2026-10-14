import type { GoogleCopy } from '../../pt/tutorials/google'

export const GOOGLE_ES: GoogleCopy = {
  tutorial: {
    slug: 'google',
    label: 'Conectar Google',
    summary:
      'La cuenta de Google conectada es la que abre las hojas de cálculo: conecte una que tenga acceso a ellas.',
    steps: [
      {
        screen: 'settings',
        title: 'Conecte la cuenta en Configuración',
        description:
          'En el menú de la app, abra Configuración. La tarjeta Conexión con Google muestra que no hay ninguna cuenta conectada — mientras tanto, el botón Nueva importación queda bloqueado. Haga clic en Conectar con Google.',
        action: 'Conectar con Google',
      },
      {
        screen: 'consent',
        title: 'Autorice en Google',
        description:
          'Se abre una ventana del propio Google. Elija la cuenta que tiene acceso a las hojas de cálculo y permita la lectura. ImportSheet solo lee — nunca modifica su hoja.',
        action: 'Continuar',
      },
      {
        screen: 'connected',
        title: 'Cuenta conectada',
        description:
          'La tarjeta pasa a mostrar Conectado y el correo de la cuenta. Las hojas que vaya a importar deben estar compartidas con ese correo.',
        action: 'Conectado',
      },
    ],
    done: {
      title: 'Google conectado',
      description:
        'El aviso desaparece de Importaciones y el botón Nueva importación queda habilitado. Ahora solo falta elegir la hoja de cálculo.',
    },
  },
  screens: {
    consent: {
      signIn: 'Iniciar sesión con Google',
      heading: 'ImportSheet quiere acceder a tu Cuenta de Google',
      allow: 'Esto permitirá que ImportSheet:',
      scopes: [
        'Ver todas tus hojas de cálculo de Google Sheets',
        'Ver y descargar todos tus archivos de Google Drive',
      ],
      cancel: 'Cancelar',
      proceed: 'Continuar',
    },
  },
}
