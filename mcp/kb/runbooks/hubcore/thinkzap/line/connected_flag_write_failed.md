---
category: internal
audience: suporte
summary: Observabilidade — o canal conectou, mas o campo Conectado do item da linha não foi atualizado no CRM.
---
# thinkzap.line.connected_flag_write_failed

## O que significa
O canal do WhatsApp Oficial conectou, mas o campo "Conectado" do item da linha no CRM interno não foi atualizado. A linha funciona normalmente. Só relatórios e filtros do CRM que usam esse campo ficam desatualizados.

## Causa provável
- **Bitrix24 indisponível** no momento da escrita.

## Como verificar
1. Filtre os Logs pelo `itemId` e confirme `código de erro: thinkzap.line.connected_flag_write_failed`.

## Como resolver
Nenhuma ação para o cliente. Se o CRM precisar refletir agora, marcar o campo no item à mão.

## Quando escalar
Se o erro aparece em todo evento de conexão. Anexe: `itemId`, `channelId` e o `err`.
