---
category: validation
audience: suporte
summary: A sessão do parceiro não trouxe a identificação da instalação, então o app não sabe em qual conta operar.
---
# thinkzap.app.context_missing

## O que significa
O app thinkzap precisa saber, a cada ação, de qual instalação a requisição veio. Neste caso essa identificação não chegou junto com a sessão do parceiro, então o app não consegue prosseguir. É quase sempre uma questão de sessão: o app foi aberto fora do contexto esperado, ou a sessão expirou/ficou desatualizada. Não é um erro de integração externa.

## Causa provável
- **Sessão expirada ou desatualizada**: o app ficou aberto por muito tempo e a sessão perdeu a validade.
- **App aberto fora do portal**: a tela foi acessada por um link direto/favorito, sem passar pela abertura normal dentro do portal.
- **Instalação incompleta ou removida**: o app foi reinstalado ou removido e a sessão antiga não corresponde mais.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.app.context_missing`.
3. Leia na linha do log se o problema é a ausência da identificação da instalação (e não uma falha de integração externa como a z-api).

## Como resolver
1. Oriente o parceiro a recarregar o app de dentro do portal (fechar e abrir novamente pela navegação normal, não por link salvo).
2. Se persistir, peça para reinstalar o app no portal e reabrir para renovar a sessão.
3. Confirme com o parceiro que a ação voltou a funcionar após reabrir.

## Quando escalar
Se o erro continuar mesmo após recarregar e reinstalar o app, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.app.context_missing`, domínio do parceiro, o horário do evento e qual tela/ação o parceiro estava usando.
