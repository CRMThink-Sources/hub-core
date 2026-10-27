# Spec Delta

## Purpose

Define como o envio pela fila de saída da linha encontra a linha de destino. Separa a linha que de fato não existe mais de uma falha temporária na consulta, e garante que uma instabilidade do Bitrix não faça mensagens se perderem em silêncio.

## ADDED Requirements

### Requirement: Linha inexistente é falha definitiva imediata
Quando a linha de destino de uma mensagem da fila de saída não estiver na instalação (o item de assinatura não existe entre as assinaturas da instalação, ou não tem provider configurado), o sistema SHALL marcar a mensagem como falha definitiva na mesma execução, sem novas tentativas, com o motivo "Linha não encontrada na instalação". Isso só vale quando a consulta dos dados da instalação **foi concluída**. O operador SHALL ser avisado da falha como já é hoje.

#### Scenario: Linha removida da instalação
- **WHEN** o worker processa uma mensagem cuja linha foi removida da instalação e a consulta dos dados da instalação retorna normalmente
- **THEN** a mensagem fica com status `FAILED` e motivo "Linha não encontrada na instalação"
- **AND** nenhuma nova tentativa é agendada
- **AND** o operador recebe o aviso de falha

### Requirement: Falha temporária na consulta da linha é retentada
Quando a consulta dos dados da instalação falhar por qualquer motivo que não seja "linha não encontrada" (por exemplo erro do Bitrix, erro de rede, limite de requisições ou tempo esgotado), e não houver cópia de reserva disponível, o sistema SHALL devolver a mensagem para a fila para uma nova tentativa. A mensagem SHALL permanecer `PENDING`, e a tentativa que falhou SHALL ficar registrada no log do job com o erro original.

As tentativas SHALL ser espaçadas de forma crescente, cobrindo pelo menos 60 segundos entre a primeira e a última.

#### Scenario: Bitrix instável na primeira tentativa
- **WHEN** o worker processa uma mensagem e a consulta ao Bitrix falha com `Failed to list CRM items`, sem cópia de reserva
- **THEN** a mensagem continua `PENDING`
- **AND** uma nova tentativa é agendada com espera
- **AND** o operador não recebe aviso de falha

#### Scenario: Bitrix volta antes da última tentativa
- **WHEN** a primeira tentativa falha na consulta ao Bitrix e a segunda tentativa consegue consultar
- **THEN** a mensagem é enviada normalmente e fica `SENT`

### Requirement: Esgotamento das tentativas vira falha com motivo real
Quando a última tentativa também falhar na consulta da linha, o sistema SHALL marcar a mensagem como `FAILED` com um motivo que identifique uma falha temporária na consulta da linha, incluindo o erro original resumido, e SHALL avisar o operador como em qualquer outra falha. A mensagem MUST NOT ficar indefinidamente em `PENDING` ou `SENDING`.

#### Scenario: Bitrix fora do ar durante todas as tentativas
- **WHEN** todas as tentativas de uma mensagem falham na consulta ao Bitrix
- **THEN** a mensagem fica `FAILED`
- **AND** o motivo registrado indica falha temporária na consulta da linha, não "Linha não encontrada na instalação"
- **AND** o operador recebe o aviso de falha

### Requirement: Cópia de reserva dos dados da assinatura
Os dados da instalação usados para resolver a linha (assinaturas, itens de assinatura, planos e produtos) SHALL ter, além do cache normal de 5 minutos, uma cópia de reserva com validade de 24 horas, atualizada a cada leitura bem-sucedida do Bitrix.

A cópia de reserva SHALL ser usada **somente** quando a leitura no Bitrix falhar. Com o Bitrix respondendo, o comportamento SHALL ser o atual: o cache normal vale por até 5 minutos, e a invalidação por alteração continua imediata.

Cada uso da cópia de reserva SHALL gerar um log de aviso com a chave usada e o erro original.

Sem cópia de reserva disponível, a falha do Bitrix SHALL seguir para o requisito "Falha temporária na consulta da linha é retentada".

#### Scenario: Bitrix falha com cópia de reserva disponível
- **WHEN** o cache normal da linha venceu, a leitura no Bitrix falha e existe cópia de reserva gravada há menos de 24 horas
- **THEN** a linha é resolvida pela cópia de reserva
- **AND** a mensagem é enviada na mesma tentativa
- **AND** fica registrado um log de aviso do uso da cópia de reserva

#### Scenario: Bitrix respondendo não usa a cópia de reserva
- **WHEN** o cache normal venceu e a leitura no Bitrix funciona
- **THEN** o resultado vem do Bitrix e atualiza tanto o cache normal quanto a cópia de reserva

#### Scenario: Linha cancelada com Bitrix respondendo
- **WHEN** uma linha foi cancelada há mais de 5 minutos e o Bitrix está respondendo
- **THEN** o cancelamento vale normalmente, mesmo que a cópia de reserva ainda tenha a linha ativa

#### Scenario: Cópia de reserva vencida
- **WHEN** a leitura no Bitrix falha e a cópia de reserva tem mais de 24 horas ou não existe
- **THEN** a falha segue para nova tentativa da fila
