// Tela de login do Authorization Server (renderizada no /authorize). HTML puro em
// string — sem engine de template. Os params OAuth voltam como hidden pra sobreviver
// ao POST. O domínio da sessão vem do cadastro do usuário, não do login.

export type LoginHiddenParams = {
  clientId: string
  redirectUri: string
  state?: string
  codeChallenge: string
  scope: string
  resource?: string
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hidden(name: string, value?: string): string {
  if (value === undefined) return ''
  return `<input type="hidden" name="${name}" value="${esc(value)}">`
}

export function renderLoginPage(opts: {
  params: LoginHiddenParams
  error?: string
  email?: string
}): string {
  const { params, error, email } = opts

  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acesso ao suporte CRMThink</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh;
    display: grid; place-items: center; background: #0f172a; color: #e2e8f0; }
  .card { width: 100%; max-width: 380px; padding: 32px; background: #1e293b;
    border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.4); }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { margin: 0 0 24px; font-size: 13px; color: #94a3b8; }
  label { display: block; font-size: 13px; margin: 14px 0 6px; }
  input { width: 100%; padding: 10px 12px; border-radius: 8px;
    border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 14px; }
  button { width: 100%; margin-top: 24px; padding: 11px; border: 0; border-radius: 8px;
    background: #6366f1; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:hover { background: #4f46e5; }
  .error { margin: 16px 0 0; padding: 10px 12px; border-radius: 8px;
    background: #7f1d1d; color: #fecaca; font-size: 13px; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/mcp-oauth/login">
    <h1>Suporte CRMThink</h1>
    <p class="sub">Entre para autorizar o acesso aos logs.</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <label for="email">E-mail</label>
    <input id="email" name="email" type="email" required autocomplete="username"
      value="${email ? esc(email) : ''}">
    <label for="password">Senha</label>
    <input id="password" name="password" type="password" required autocomplete="current-password">
    ${hidden('client_id', params.clientId)}
    ${hidden('redirect_uri', params.redirectUri)}
    ${hidden('state', params.state)}
    ${hidden('code_challenge', params.codeChallenge)}
    ${hidden('scope', params.scope)}
    ${hidden('resource', params.resource)}
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`
}
