# Fluxo de instalação (Bitrix24)

Documentação do fluxo de instalação do app no Bitrix24: desde a tela de termos no front até o registro no backend.

---

## Visão geral

1. **Frontend (auth):** o usuário informa o e-mail e aceita os termos (Bitrix, EULA, privacidade).
2. **Frontend:** envia ao backend os dados do ambiente, e-mail e aplicação que está sendo instalada.
3. **Backend:** valida a requisição, identifica a aplicação, obtém ou cria o domínio e responde com domínio + app.

---

## Frontend (página de instalação)

**Arquivo:** `apps/auth/app/bitrix/install/page.tsx`

### O que o usuário faz

- Informa o **e-mail** de instalação.
- Aceita os três termos:
  - Termos do Bitrix
  - Contrato de licença (EULA)
  - Política de privacidade

### Validações no frontend

- Os três termos precisam estar aceitos.
- E-mail obrigatório (não vazio).
- `BX24` deve estar disponível (página aberta no Bitrix24).

### Envio ao backend

- **Endpoint:** `POST {NEXT_PUBLIC_API_URL}/auth/install`
- **Payload:** obtido via `getInstallPayload(email)` do `@repo/bitrix` (ambiente, `member_id`, `appCode`, e-mail, etc.).

### Estados da tela

- Carregando script / Conectando ao Bitrix24
- Formulário (e-mail + termos)
- Sucesso ou erro (com mensagem)

---

## Backend (API)

**Rota:** `POST /auth/install`  
**Controller:** `InstallController`  
**Arquivo:** `apps/api/src/modules/auth/presentation/controllers/install-controller.ts`

### Payload esperado no body

| Campo       | Obrigatório | Descrição                          |
|------------|-------------|------------------------------------|
| `domain`   | Sim         | Nome/identificador do domínio      |
| `member_id`| Sim         | ID do membro no Bitrix             |
| `appCode`  | Sim         | Código da aplicação sendo instalada|

### Fluxo no backend

1. **Validação:** presença de `domain`, `member_id` e `appCode`. Caso falte algum → `400 Bad Request`.
2. **Aplicação:** busca da aplicação pelo `appCode` na lista de apps disponíveis. Se não existir → `404 Not Found`.
3. **Domínio:** execução do caso de uso **GetOrCreateDomain**:
   - Se já existir domínio com o `name` informado → retorna o existente.
   - Caso contrário → cria novo registro na tabela de domínios (`name`, `memberId`).
4. **Resposta:** `200 OK` com `{ data: { ...domain, app: availableApp } }`.

### Caso de uso: GetOrCreateDomain

**Arquivo:** `apps/api/src/modules/auth/application/get-or-create-domain.ts`

- **Entrada:** `{ name, memberId }`
- **Lógica:** `getDomain(name)` → se existir, retorna; senão `createDomain({ name, memberId })`.

---

## Configuração

- **Auth (frontend):** definir `NEXT_PUBLIC_API_URL` em `.env.local` com a URL base da API (ex.: `https://api.exemplo.com`). O install chama `POST {NEXT_PUBLIC_API_URL}/auth/install`.

---

## Possíveis extensões (a documentar quando implementadas)

- Registro na **tabela de aplicativos instalados** (vínculo domínio + app).
- Armazenamento na **tabela de credenciais** (client_id, client_secret, token, refresh_token) para renovação de token quando expirar.

Quando esses passos forem implementados, vale atualizar este doc com os novos endpoints/casos de uso e tabelas.
