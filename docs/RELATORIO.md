# Relatório — Sistema de Chat Distribuído

**Disciplina:** Sistemas Distribuídos — CEFET-MG — 2026/1
**Professora:** Michelle Hanne
**Código-fonte:** `<https://github.com/MatheusMnz/ChatDistribuido>`

> Relatório com as decisões de projeto/implementação e a avaliação dos estudos de
> caso. (Máx. 5 páginas — ao exportar para PDF, ajuste conforme necessário.)

---

## 1. Visão geral e decisões de arquitetura

O sistema é uma plataforma de mensageria em tempo real construída sobre uma
arquitetura de **microsserviços** orquestrada por **Docker Compose**. Todo o
código é escrito em **TypeScript**, garantindo tipagem estática de ponta a ponta.

Os três pilares exigidos foram endereçados assim:

- **Alta disponibilidade:** o serviço de chat roda em **múltiplas instâncias**
  independentes. A falha de uma instância não interrompe o serviço — as demais
  continuam atendendo (verificável com `docker compose stop chat-service-1`).
- **Comunicação em tempo real:** uso de **WebSockets** (Socket.IO), que mantém
  conexões persistentes e entrega mensagens via *push*, com baixa latência.
- **Escalabilidade horizontal:** novas instâncias do chat podem ser adicionadas
  atrás do **NGINX** (balanceador). A consistência do *broadcast* entre instâncias
  é garantida por um **adapter Redis** (Pub/Sub).

### 1.1 Divisão em microsserviços

| Serviço | Responsabilidade | Banco | Tecnologias |
|---|---|---|---|
| **auth-service** | Ciclo de vida do usuário: cadastro, login, emissão de JWT, listagem de usuários | PostgreSQL | Express, `pg`, `bcryptjs`, `jsonwebtoken` |
| **chat-service** | Envio, recebimento, armazenamento e transmissão em tempo real de mensagens | MongoDB | Express, Socket.IO, Mongoose, Redis adapter |

Os serviços são **independentes**: têm seu próprio banco, *deploy* (Dockerfile) e
ciclo de vida. A comunicação entre eles é desacoplada pelo **JWT**: o `auth-service`
**assina** o token e o `chat-service` o **valida** com o mesmo segredo
compartilhado, sem necessidade de chamada síncrona a cada operação — decisão que
favorece a escalabilidade (autenticação *stateless*).

### 1.2 Escolha dos bancos de dados (poliglota)

Seguindo a recomendação do enunciado, adotamos persistência poliglota:

- **PostgreSQL (relacional)** para usuários: os dados são bem estruturados e
  exigem integridade (unicidade de `username`, relações claras).
- **MongoDB (NoSQL orientado a documentos)** para mensagens e conversas:
  otimizado para **alta taxa de escrita** e leitura de documentos, e o modelo de
  documento encaixa naturalmente com mensagens e listas de participantes.

### 1.3 Tempo real e o problema do *fan-out* entre instâncias

Com mais de uma instância de chat, dois usuários podem estar conectados a
instâncias diferentes. Uma mensagem recebida pela instância 1 precisa alcançar um
destinatário conectado à instância 2. Resolvemos isso com o
**`@socket.io/redis-adapter`**: cada instância publica/assina eventos num canal
Redis, de modo que o `broadcast` para a sala de um usuário (`user:<id>`) atravessa
todas as instâncias. Esse é o mecanismo central que torna o sistema **horizontalmente
escalável** sem perder a entrega em tempo real.

### 1.4 Modelo de salas (rooms)

Cada usuário entra na sala `user:<userId>` ao conectar; cada conversa usa a sala
`conversation:<conversationId>`. No envio, a mensagem é persistida e então emitida
para a sala `user:<id>` de **cada participante** — garantindo entrega tanto **1:1**
(conversa `direct`) quanto **1:N** (conversa `group`), independentemente da
instância que atende cada cliente.

### 1.5 Gateway e balanceamento

O **NGINX** é o ponto único de entrada (porta 8080) e atua como **balanceador de
carga**. Como as rotas REST são *stateless*, usamos **round-robin** para elas; já
as conexões WebSocket (persistentes) usam **`least_conn`**, que envia cada nova
conexão à instância com menos conexões ativas. Os clientes usam transporte
*websocket-only*, dispensando *sticky sessions*; a entrega de mensagens entre
instâncias é garantida pelo Redis adapter. Assim a carga (tanto de requisições
quanto de conexões) é efetivamente distribuída entre as réplicas.

---

## 2. Implementação

### 2.1 Front-end (Interface do Usuário)

SPA **React + Vite** responsiva. Apresenta a **lista de conversas** (à esquerda,
com prévia da última mensagem) e a **área de visualização/envio** (à direita), no
padrão de um *messenger*. Em telas estreitas, alterna entre lista e conversa
(layout mobile). Recursos: criação de conversas 1:1 e grupos 1:N (seleção de
usuários), indicador de digitação, presença *online*, status de conexão, rolagem
automática e tratamento de erros de login/cadastro.

### 2.2 Comunicação e mensagens

- **REST** (via gateway): `POST/GET /api/conversations`,
  `GET /api/conversations/:id/messages` (histórico paginado). Conversas `direct`
  são **reutilizadas** (não duplicam) entre o mesmo par de usuários.
- **WebSocket**: `message:send`, `message:new`, `conversation:join`, `typing`,
  `presence`, `conversation:updated`. A autenticação ocorre no *handshake* (JWT);
  conexões com token inválido são **rejeitadas**.
- **Persistência**: toda mensagem é gravada no MongoDB e a conversa tem sua
  `lastMessage`/`updatedAt` atualizadas, alimentando o histórico e a ordenação da
  lista.

---

## 3. Avaliação dos estudos de caso (Plano de Testes)

Os testes estão em três níveis. Os de unidade/integração por serviço rodam **sem
dependências externas** (mocks e bancos em memória); os de ponta-a-ponta/carga
rodam contra a **stack real** subida via Docker.

### 3.1 Testes Unitários — *lógica de negócio central*

- **auth-service** (`npm test`): **20 testes** — validação de credenciais de
  login, *hash* de senha, emissão/verificação de JWT, rejeição de usuário
  duplicado e de credenciais inválidas. Cobertura ~94%.
- **chat-service** (`npm test`): inclui testes unitários de **persistência correta
  de mensagens** (gravação e recuperação) e de regras de conversa (reuso de DM,
  criação de grupo, autorização de participante).

### 3.2 Testes de Integração

- **chat-service — `socket.integration.test.ts`**: sobe o servidor Socket.IO,
  conecta dois clientes autenticados e prova que uma mensagem enviada por A é
  **recebida por B em tempo real** e **persistida** no banco.
- **ponta-a-ponta — `load-tests/npm run e2e`**: exercita os **dois serviços
  juntos**, exatamente o caso do enunciado — *"autenticar e, em seguida, enviar
  uma mensagem"*: autentica no `auth-service`, usa o JWT para conectar ao
  `chat-service`, troca mensagens 1:1 e 1:N, valida persistência no histórico e
  autorização (não-participante recebe **403**). Cobre também a comunicação do
  *front-end* com o *backend* (mesmo contrato REST/WebSocket consumido pela SPA).
- **Total automatizado por serviço:** auth **20/20** e chat **25/25** testes
  passando.

### 3.3 Teste de Concorrência/Carga

`load-tests/npm run load` simula **12 usuários simultâneos** (configurável; o PDF
exige ≥10) que autenticam, abrem conexões WebSocket em paralelo e disparam
mensagens em rajada num grupo 1:N. O script mede:

- **Taxa de entrega** (mensagens recebidas / esperadas no *fan-out*);
- **Latência** p50/p95/p99 de entrega ponta-a-ponta;
- **Vazão** (entregas por segundo).

O critério de sucesso é entrega ≥ 99% a todos os participantes. O script
`npm run lb` complementa a avaliação medindo a **distribuição das requisições**
entre `chat-service-1` e `chat-service-2` (header `X-Instance`), evidenciando o
**balanceamento de carga** e a **escalabilidade horizontal**.

> **Resultados obtidos** (execução em Docker Desktop / Windows, 2 instâncias de chat):
>
> - **Integração (`e2e`):** 16/16 verificações ✓ — autenticação, conexão WebSocket
>   com JWT do auth, rejeição de token inválido, mensagem 1:1 e 1:N em tempo real,
>   persistência no MongoDB, reuso de conversa direta e autorização (403).
> - **Carga (`load`):** 12 usuários simultâneos, 60 mensagens enviadas, **720/720
>   entregas (100%)** no *fan-out* do grupo 1:N; vazão ≈ **1.513 entregas/s**;
>   latência **p50/p95/p99 = 69/111/130 ms**. As 12 conexões foram distribuídas
>   entre as duas instâncias (verificado nos logs), de modo que o caminho de
>   entrega **entre instâncias via Redis** foi exercitado.
> - **Balanceamento (`lb`):** 40 requisições REST → **20 na chat-1 e 20 na chat-2**,
>   confirmando a distribuição de carga.

---

## 4. Como executar

```bash
docker compose up --build       # sobe tudo; app em http://localhost:8080
# Testes por serviço:
cd services/auth-service && npm install && npm test
cd services/chat-service && npm install && npm test
# Testes de integração/carga (com a stack no ar):
cd load-tests && npm install && npm run e2e && npm run load && npm run lb
```

## 5. Conclusão

A solução atende a todos os requisitos mínimos: arquitetura distribuída de
microsserviços, comunicação assíncrona em tempo real por WebSockets, persistência
poliglota (PostgreSQL + MongoDB), mensagens 1:1 e 1:N com histórico, interface
responsiva e os três tipos de teste exigidos. As decisões de projeto — JWT
*stateless*, adapter Redis para *fan-out* entre instâncias e NGINX como
balanceador — foram tomadas visando especificamente **alta disponibilidade**,
**baixa latência** e **escalabilidade horizontal**.
