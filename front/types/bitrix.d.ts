/**
 * Augmenta Window com BX24 (tipos completos vêm de @repo/bitrix quando o pacote está instalado).
 */
declare global {
  interface Window {
    BX24?: {
      init: (callback: () => void) => void;
      installFinish: () => void;
      getAuth?: () => unknown;
      callMethod?: (method: string, params?: object, callback?: (result: unknown) => void) => void;
    };
  }
}

export { };
