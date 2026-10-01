---
category: integration
audience: suporte
summary: Observabilidade — uma tela do app não foi removida do Bitrix24 na desinstalação; ela pode continuar aparecendo no portal.
---
# thinkzap.install.placement_unbind_failed

## O que significa
Na desinstalação, o app pede ao Bitrix24 para remover as telas que registrou (`placement.unbind`): a aba do CRM, a aba das SPAs e os ícones do chat (áudio e botões). Uma dessas remoções foi recusada ou não respondeu. A desinstalação segue normalmente; o único efeito é a tela continuar aparecendo no portal, apontando para um app que não está mais lá.

## Causa provável
- **Token da instalação já revogado** no momento da desinstalação.
- **Escopo `placement` ausente** na instalação.
- **Instabilidade do Bitrix24**.

## Como verificar
1. Filtre os Logs pelo domínio e confirme `código de erro: thinkzap.install.placement_unbind_failed`.
2. O log traz `placement` (ex.: `CRM_DEAL_DETAIL_TAB`, `CRM_DYNAMIC_<id>_DETAIL_TAB`, `IM_TEXTAREA`) e o `err` do Bitrix.

## Como resolver
1. Se o parceiro não vê tela órfã, nenhuma ação.
2. Se vê: reinstalar o app e desinstalar de novo, ou remover a tela pelas configurações de aplicativos do portal.

## Quando escalar
Se a tela órfã continua depois de reinstalar e desinstalar. Anexe: domínio, `placement` e o `err` do log.
