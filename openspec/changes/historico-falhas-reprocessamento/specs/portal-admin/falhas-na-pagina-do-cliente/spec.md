## Purpose

Mostra as falhas de mensagens de um cliente dentro da página dele no backoffice, para o suporte atender sem sair do contexto do cliente.

## ADDED Requirements

### Requirement: Seção de falhas na página do cliente
A página de detalhe do cliente em `/admin/clientes/<id>`, quando o cliente tiver o ThinkZap instalado, SHALL mostrar a seção "Falhas de mensagens" com as falhas de envio e de recebimento dos últimos 7 dias daquele portal, da mais recente para a mais antiga, limitadas a uma página curta. A seção SHALL filtrar pelo portal exato do cliente, e não por trecho do nome.

Cada item SHALL mostrar direção (envio ou recebimento), situação, erro resumido e horário, e SHALL abrir o detalhe da falha. A seção SHALL oferecer um link para a tela geral de falhas já filtrada pelo portal do cliente.

#### Scenario: Cliente com falhas
- **WHEN** o administrador abre a página de um cliente que teve 3 falhas de envio e 1 de recebimento na última semana
- **THEN** a seção mostra as 4, da mais recente para a mais antiga

#### Scenario: Cliente sem falhas
- **WHEN** o administrador abre a página de um cliente sem falhas no período
- **THEN** a seção informa que não há falhas nos últimos 7 dias

#### Scenario: Portal com nome parecido
- **WHEN** existem os portais `acme` e `acme-filial` e o administrador abre a página de `acme`
- **THEN** a seção mostra só as falhas do `acme`

#### Scenario: Ir para a tela geral
- **WHEN** o administrador escolhe o link da seção
- **THEN** o portal abre `/admin/falhas-envio` já filtrada pelo cliente

### Requirement: Falha ao carregar a seção não derruba a página
Se a consulta das falhas falhar, a seção SHALL mostrar o erro com a opção de tentar de novo, e o restante da página do cliente SHALL continuar disponível.

#### Scenario: Erro na consulta
- **WHEN** a API de falhas responde com erro ao abrir a página do cliente
- **THEN** a seção mostra "indisponível" com um botão para tentar de novo e o resto da página continua funcionando

### Requirement: Reprocessar a partir da seção
A seção SHALL permitir reprocessar uma falha reprocessável, com as mesmas regras e confirmações das telas de falha (inclusive o aviso de risco de duplicidade em resultado indeterminado), e SHALL atualizar a lista depois da ação.

#### Scenario: Reprocessar pela página do cliente
- **WHEN** o administrador reprocessa uma falha de envio pela seção
- **THEN** a mensagem volta para a fila e a seção reflete a nova situação

### Requirement: Idioma da seção
Os textos da seção SHALL estar disponíveis em `pt`, `en` e `es`.

#### Scenario: Idioma espanhol
- **WHEN** o portal admin está em `es`
- **THEN** a seção aparece em espanhol
