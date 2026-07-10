// HTML devolvido no callback OAuth: avisa a janela que abriu o popup e fecha.
export function oauthPopupHtml(
  messageType: string,
  status: 'success' | 'error',
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
    try { window.opener.postMessage({ type: '${messageType}', status: '${status}' }, '*') } catch(_) {}
    window.close()
  </script></body></html>`
}
