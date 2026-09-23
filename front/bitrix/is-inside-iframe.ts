/**
 * A página está dentro de um iframe — no caso dos apps do hub, o do Bitrix24.
 *
 * Todo placement do app abre em iframe; página top-level é acesso direto pelo
 * navegador (link copiado, aba nova), onde não existe token nem BX24.
 *
 * Se ler `window.top` lançar (política cross-origin de algum navegador), conta
 * como dentro: bloquear o app dentro do Bitrix seria pior do que deixar passar
 * um acesso direto, que já cai no aviso de sessão.
 *
 * Só no cliente: no SSR não há `window` e a resposta é `false`.
 */
export function isInsideIframe(
  win: Window | undefined = globalWindow(),
): boolean {
  if (!win) return false
  try {
    return win.self !== win.top
  } catch {
    return true
  }
}

const globalWindow = (): Window | undefined =>
  typeof window === 'undefined' ? undefined : window
