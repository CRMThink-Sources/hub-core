import type { NovaImportacaoCopy } from '../../pt/tutorials/nova-importacao'

export const NOVA_IMPORTACAO_ES: NovaImportacaoCopy = {
  tutorial: {
    slug: 'nova-importacao',
    label: 'Nueva importación',
    summary: 'Elija la hoja de Google y la pestaña que va a Bitrix24.',
    steps: [
      {
        screen: 'empty',
        title: 'Inicie una importación',
        description: 'En Importaciones, haga clic en Nueva importación.',
        action: 'Nueva importación',
      },
      {
        screen: 'paste',
        title: 'Pegue el enlace de la hoja',
        description:
          'Pegue el enlace completo de la hoja o solo el ID — el tramo entre /d/ y /edit en la dirección docs.google.com/spreadsheets/d/…. Luego haga clic en Validar.',
        action: 'Validar',
      },
      {
        screen: 'tabs',
        title: 'Seleccione la pestaña',
        description:
          'Con la hoja validada, aparecen las pestañas con el total de filas y columnas de cada una. Elija la que tiene los datos.',
        action: 'Seleccionar la pestaña',
      },
      {
        screen: 'selected',
        title: 'Continúe a la configuración',
        description:
          'Con la pestaña elegida, haga clic en Continuar para definir el destino en Bitrix24 y la asignación de columnas.',
        action: 'Continuar',
      },
    ],
    done: {
      title: 'Hoja validada',
      description:
        'Si la validación falla, revise el enlace y que la hoja esté compartida con el correo de la cuenta de Google conectada.',
    },
  },
  screens: {
    modal: {
      title: 'Nueva importación',
      description: 'Ingrese el ID (o enlace) de la hoja de cálculo de Google',
      idLabel: 'ID de la hoja',
      placeholder: 'ej.: 1AbC…XyZ o la URL de la hoja',
      validate: 'Validar',
      urlHint: 'El ID está en la URL:',
      selectTab: 'Seleccione la pestaña',
      rowsCols: (rows: number, cols: number) =>
        `${rows} filas · ${cols} columnas`,
      cancel: 'Cancelar',
      proceed: 'Continuar',
    },
    pastedUrl: 'https://docs.google.com/spreadsheets/d/1AbC9xZ…/edit',
    tabs: [
      { title: 'Pedidos', rows: 1250, cols: 6 },
      { title: 'Archivo 2025', rows: 830, cols: 6 },
    ],
  },
}
