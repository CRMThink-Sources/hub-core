## Purpose

Dá ao suporte a linha do tempo das tentativas que falharam de cada mensagem, de envio ou de recebimento, para entender o que aconteceu sem consultar logs nem o Redis.

## ADDED Requirements

### Requirement: Tentativa que falha é registrada
Toda tentativa de envio ou de recebimento que termina em erro SHALL gerar um registro ligado ao item (a mensagem da fila de saída ou a falha de recebimento), com:
- número da tentativa;
- código de erro (o do catálogo de erros, ou "não classificado");
- mensagem do erro;
- duração da tentativa;
- horário.

Tentativa bem-sucedida SHALL NOT gerar registro. Tentativa adiada sem gastar tentativa (cadência, limite diário, destino ocupado) SHALL NOT gerar registro. Uma tentativa de envio de resultado indeterminado SHALL ser registrada como tal, distinguível de erro definitivo.

Se a gravação do registro falhar, o envio ou o recebimento SHALL seguir como se ela não existisse.

#### Scenario: Envio falha duas vezes e a terceira passa
- **WHEN** um envio falha nas tentativas 1 e 2 e é entregue na 3
- **THEN** existem 2 registros de tentativa para a mensagem e nenhum para a 3

#### Scenario: Envio esgota as tentativas
- **WHEN** um envio falha nas 4 tentativas
- **THEN** existem 4 registros, o último com o erro que deixou a mensagem em falha

#### Scenario: Resultado indeterminado
- **WHEN** a chamada ao provider estoura o tempo e a mensagem fica com resultado indeterminado
- **THEN** a tentativa é registrada como indeterminada

#### Scenario: Tentativa adiada
- **WHEN** o envio é adiado pela cadência sem gastar tentativa
- **THEN** nenhum registro de tentativa é criado

#### Scenario: Falha ao gravar o registro
- **WHEN** o banco recusa a gravação do registro de tentativa
- **THEN** o erro é logado e a mensagem segue o fluxo normal da fila

### Requirement: Detalhe mostra as tentativas em ordem
O detalhe de uma falha, na aba "Envio" e na aba "Recebimento", SHALL listar as tentativas registradas em ordem cronológica, cada uma com número, horário, duração, código de erro e mensagem. Item sem tentativas registradas (por exemplo, falha anterior a este recurso ou já expurgada) SHALL mostrar uma indicação de que não há tentativas registradas, e não um erro.

#### Scenario: Detalhe com tentativas
- **WHEN** o administrador abre uma falha de envio com 4 tentativas registradas
- **THEN** vê as 4 tentativas em ordem, com o código de erro de cada uma

#### Scenario: Falha anterior ao recurso
- **WHEN** o administrador abre uma falha de envio gravada antes deste recurso
- **THEN** o detalhe mostra o último erro conhecido e a indicação de que não há tentativas registradas

### Requirement: Reprocessamento mantém o histórico
Reprocessar um item SHALL manter as tentativas já registradas e acrescentar as novas, com a numeração seguindo a anterior, enquanto o item não for expurgado.

#### Scenario: Reprocessar e falhar de novo
- **WHEN** uma mensagem com 4 tentativas registradas é reprocessada e falha mais uma vez
- **THEN** o detalhe mostra as 4 anteriores e a nova, que aparece com o número 5
