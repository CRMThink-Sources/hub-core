# thinkzap/sincronizacao-edicao-exclusao-mensagem Specification

## Purpose

Leva para o WhatsApp a edição e a exclusão que o operador faz, no Contact Center do Bitrix24, em mensagens que ele mesmo enviou numa linha do ThinkZap. Assim a conversa fica igual no CRM e no aparelho do contato.

## Requirements

### Requirement: Instalação registra os eventos de mensagem
A instalação do ThinkZap SHALL registrar no portal do cliente os eventos de mensagem recebida, mensagem editada e mensagem excluída do conector, todos apontando para o webhook do app. Reinstalar SHALL NOT duplicar nenhum dos registros, e um registro que aponta para um webhook antigo SHALL ser substituído pelo atual.

#### Scenario: Instalação nova
- **WHEN** o ThinkZap é instalado num portal sem registros do app
- **THEN** o portal passa a ter os três eventos registrados, cada um uma única vez

#### Scenario: Reinstalação
- **WHEN** o ThinkZap é reinstalado num portal que já tem os três eventos registrados no webhook atual
- **THEN** nenhum registro é criado nem removido

#### Scenario: Webhook mudou entre deploys
- **WHEN** o portal tem o evento de exclusão registrado num webhook antigo e o ThinkZap é reinstalado
- **THEN** o registro antigo é removido e o evento fica registrado só no webhook atual

### Requirement: Edição do operador chega ao WhatsApp
O conector SHALL declarar ao Bitrix24 que o operador pode editar as mensagens que enviou, para que o controle de edição apareça no Contact Center. Quando o operador edita uma mensagem de uma linha não oficial (Z-API), o sistema SHALL localizar a mensagem enviada ao contato e substituir o texto dela no WhatsApp pelo texto novo.

Falha ao editar no provedor SHALL ser registrada com o código de erro de edição e SHALL NOT impedir o processamento dos demais eventos nem gerar reentrega do webhook.

#### Scenario: Operador edita mensagem enviada
- **WHEN** o operador edita, no Contact Center, uma mensagem que enviou por uma linha Z-API
- **THEN** o contato vê a mensagem editada com o texto novo no WhatsApp

#### Scenario: Mensagem sem correspondente no provedor
- **WHEN** o operador edita uma mensagem que não tem id de mensagem do provedor gravado
- **THEN** nada é enviado ao WhatsApp e o motivo fica registrado em log

#### Scenario: Provedor recusa a edição
- **WHEN** o provedor responde erro à edição
- **THEN** o erro fica registrado com o código de falha de edição, a mensagem do WhatsApp permanece como estava e o webhook é respondido com sucesso

### Requirement: Exclusão do operador chega ao WhatsApp
Quando o operador exclui, no Contact Center, uma mensagem que enviou por uma linha não oficial (Z-API), o sistema SHALL apagar a mensagem correspondente no WhatsApp do contato. O conector SHALL manter habilitada a exclusão de mensagens do operador, sem o que o Bitrix24 recusa a exclusão e nenhum evento é emitido.

Falha ao apagar no provedor SHALL ser registrada com o código de erro de exclusão e SHALL NOT gerar reentrega do webhook.

#### Scenario: Operador exclui mensagem enviada
- **WHEN** o operador exclui, no Contact Center, uma mensagem que enviou por uma linha Z-API
- **THEN** a mensagem deixa de existir no WhatsApp do contato

#### Scenario: Mensagem sem correspondente no provedor
- **WHEN** o operador exclui uma mensagem que não tem id de mensagem do provedor gravado
- **THEN** nada é enviado ao WhatsApp e o motivo fica registrado em log

#### Scenario: Provedor recusa a exclusão
- **WHEN** o provedor responde erro à exclusão
- **THEN** o erro fica registrado com o código de falha de exclusão e o webhook é respondido com sucesso

### Requirement: Linha oficial não propaga edição nem exclusão
Edição e exclusão de mensagem numa linha oficial (HubMessage) SHALL NOT ser enviadas ao WhatsApp, porque a API oficial não oferece essas operações. O evento SHALL ser recebido e encerrado sem erro.

#### Scenario: Edição numa linha oficial
- **WHEN** o evento de edição chega para uma linha oficial
- **THEN** nenhuma chamada é feita ao provedor, o evento é registrado como ignorado e o webhook responde sucesso

### Requirement: Evento sem linha correspondente é descartado
Quando o evento de edição ou exclusão chega e o sistema não encontra a linha do portal, o sistema SHALL descartar o evento registrando o motivo, sem lançar erro que provoque reentrega.

#### Scenario: Linha desconhecida
- **WHEN** chega um evento de exclusão de um portal e linha sem correspondência no sistema
- **THEN** o evento é descartado com registro em log e nenhuma chamada ao provedor é feita
