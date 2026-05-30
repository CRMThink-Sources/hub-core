# Desenvolvimento local com Bitrix24 (widget de áudio)

## Erro `Unexpected token '<'` nos chunks `/_next/...`

O navegador pediu JavaScript e recebeu HTML (quase sempre `<!DOCTYPE html>`).

### Confirmar no Network (30s)

1. Abra o widget no Bitrix24 (ou a URL do handler no iframe).
2. DevTools → **Network** → filtre por `JS` ou busque `_next/static`.
3. Abra um chunk `.js` com erro.
4. Aba **Response**:
   - Se começar com `<!DOCTYPE` ou página “Visit Site” do ngrok → **interstitial do ngrok free** (`*.ngrok-free.dev`).
   - Se for JSON/HTML de erro 404 → URL/túnel apontando para o processo errado (API em vez do Next).

Chunks devem retornar **200** e conteúdo JavaScript, não HTML.

## Por que `127.0.0.1` não serve no Bitrix cloud

`BITRIX_IFRAME_AUDIO_URL` é o `HANDLER` do `placement.bind`. O iframe abre no navegador do operador; `http://127.0.0.1:3000/...` só existe na sua máquina.

Use URL **pública HTTPS** (homolog, produção ou túnel).

## Túneis recomendados

### Opção A — Um túnel no front (com proxy `/api` no Next dev)

Com `next dev` na porta 3000, o [`front/next.config.ts`](../front/next.config.ts) encaminha `/api/*` para a API local (`4001`).

```bash
# Terminal 1 — API
cd api && yarn dev

# Terminal 2 — Front
cd front && yarn dev

# Terminal 3 — Túnel (sem interstitial nos .js)
cloudflared tunnel --url http://localhost:3000
```

No `api/.env` (ajuste o host gerado):

```env
BITRIX_IFRAME_AUDIO_URL=https://SEU-TUNEL.trycloudflare.com/bitrix/widget/audio
BITRIX_WEBHOOK_URL=https://SEU-TUNEL.trycloudflare.com/api/webhooks/bitrix
```

Re-registre o placement: portal admin **Registrar widget** ou `yarn register:audio-imbot --domain=portal.bitrix24.com.br`.

### Opção B — Dois túneis (front + API)

```env
BITRIX_IFRAME_AUDIO_URL=https://tunel-front.../bitrix/widget/audio
BITRIX_WEBHOOK_URL=https://tunel-api.../api/webhooks/bitrix
```

### Opção C — Homolog / produção

Sem túnel local. Exemplo staging:

`BITRIX_IFRAME_AUDIO_URL=https://homolog-hubthink.crmthink.com.br/bitrix/widget/audio`

## Evitar ngrok free no iframe

`*.ngrok-free.dev` injeta HTML de aviso em requests de browser. O iframe do Bitrix **não** envia `ngrok-skip-browser-warning` nos `<script src="/_next/...">`, então todos os chunks falham com `Unexpected token '<'`.

Alternativas: **cloudflared**, ngrok pago, ou homolog.

## Variáveis (API)

| Variável | Deve apontar para |
|----------|-------------------|
| `BITRIX_IFRAME_AUDIO_URL` | Front — `/bitrix/widget/audio` |
| `BITRIX_WEBHOOK_URL` | API — `/api/webhooks/bitrix` (ou mesmo túnel do front com proxy dev) |
| `BITRIX_CONNECTOR_URL` | Front — `/thinkzap/connector` |
| `BITRIX_PLACEMENT_URL` | Front — ex. `/widgets/conversations` |
