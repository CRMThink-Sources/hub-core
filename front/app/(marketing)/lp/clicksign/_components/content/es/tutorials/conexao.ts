import type { ConexaoCopy } from '../../pt/tutorials/conexao'

export const CONEXAO_ES: ConexaoCopy = {
  tutorial: {
    slug: 'conexao',
    label: 'Conectar Clicksign',
    summary:
      'Registra la cuenta de Clicksign que envía los documentos: token de acceso, entorno y recordatorio.',
    steps: [
      {
        screen: 'name',
        title: 'Ponle un nombre a la empresa',
        description:
          'En la app, en Configuración › Principal, la primera empresa ya viene en blanco con el nombre Nueva Empresa. Cámbialo por el nombre de tu cuenta: es el que aparece en el robot de Bitrix24. Cada empresa es una cuenta de Clicksign — para registrar otra, haz clic en Nueva Empresa.',
        action: 'Nombre de la empresa',
      },
      {
        screen: 'token',
        title: 'Pega el token de acceso',
        description:
          'En el panel de Clicksign, copia el token de acceso a la API de tu cuenta y pégalo en Token de Acceso. Es el que autoriza el envío desde tu cuenta.',
        action: 'Token de Acceso',
      },
      {
        screen: 'environment',
        title: 'Elige el entorno',
        description:
          'Producción envía documentos reales. Sandbox es el entorno de pruebas de Clicksign. El token debe ser del mismo entorno elegido aquí.',
        action: 'Producción',
      },
      {
        screen: 'reminder',
        title: 'Define el recordatorio automático',
        description:
          'Clicksign le recuerda a quien todavía no firmó cada 1, 2, 3, 7 o 14 días.',
        action: '3 días',
      },
      {
        screen: 'save',
        title: 'Guarda',
        description:
          'Haz clic en Guardar. Al guardar, la app activa sola el retorno de estado de Clicksign a Bitrix24 — no hace falta configurar nada en el panel de Clicksign.',
        action: 'Guardar',
      },
    ],
    done: {
      title: 'Clicksign conectada',
      description:
        'La cuenta está lista para enviar. Ahora prepara la negociación con los campos que reciben el documento y el resultado de la firma.',
    },
  },
  screens: {},
}
