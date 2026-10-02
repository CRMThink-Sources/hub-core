---
category: integration
audience: suporte
summary: Observabilidade — a z-api não devolveu o número do aparelho da linha; a tela mostra a linha sem telefone.
---
# thinkzap.zapi.phone_data_failed

## O que significa
A z-api não devolveu os dados do aparelho da linha (endpoint `device`). A tela de linhas e o rótulo do participante "eu" nos grupos ficam sem o número. Envio e recebimento não são afetados.

## Causa provável
- **Instabilidade da z-api**.
- **Instância recém-conectada**, ainda sem dados do aparelho.
- **Token da instância inválido**.

## Como verificar
1. Filtre os Logs pelo `instanceId` e confirme `código de erro: thinkzap.zapi.phone_data_failed`.
2. Um caso isolado é instabilidade. O mesmo `instanceId` em sequência é estrutural.

## Como resolver
1. Pontual: nenhuma ação.
2. Recorrente: conferir a linha na aba Conexão. Se estiver desconectada, ler o QR Code de novo.

## Quando escalar
Se a linha está conectada e o erro é constante para a instância. Anexe: `instanceId` e o `err`.
