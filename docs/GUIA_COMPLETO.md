# Guia Completo — Sistema de Chat Distribuído

Documento único, completo e atualizado: o que o projeto é, o que usa, como o banco
de dados armazena os dados, **como subir tudo com instruções exatas** e como validar
cada funcionalidade (1:1, 1:N, tempo real, histórico, presença, alta disponibilidade
e balanceamento de carga).

> Trabalho Final de Sistemas Distribuídos — CEFET-MG (2026/1).
> **Código-fonte:** `<https://github.com/MatheusMnz/ChatDistribuido>`
> Relatório acadêmico resumido (≤5 páginas): [RELATORIO.md](RELATORIO.md).
> Contrato técnico de APIs/eventos: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Visão geral

Plataforma de mensageria em tempo real com arquitetura **distribuída de
microsserviços**. Atende aos três pilares exigidos:

- **Alta disponibilidade** — o serviço de chat roda em múltiplas instâncias; a queda
  de uma não derruba o sistema.
- **Comunicação em tempo real** — WebSockets (Socket.IO) entregam mensagens por *push*
  com baixa latência (medido: p95 ≈ 111 ms).
- **Escalabilidade horizontal** — novas instâncias do chat entram atrás do NGINX e o
  Redis garante a entrega de mensagens entre elas.

Todo o código é **TypeScript**. A orquestração é via **Docker Compose** (um comando
sobe tudo).

---

## 2. Tecnologias usadas (e onde)

| Camada | Tecnologia | Container (porta) | Papel |
|---|---|---|---|
| Gateway / Balanceador | **NGINX** | `gateway` (8080) | Entrada única; distribui carga entre as instâncias do chat |
| Microsserviço de Autenticação | **Node + TypeScript + Express** | `auth-service` (4000) | Cadastro, login, emissão de JWT, lista de usuários |
| Microsserviço de Chat (×2) | **Express + Socket.IO** | `chat-service-1` / `-2` (5000) | Envio/recebimento em tempo real + histórico |
| Banco relacional | **PostgreSQL** | `postgres` (5432) | Usuários |
| Banco NoSQL | **MongoDB** | `mongo` (27017) | Conversas e mensagens |
| Pub/Sub entre instâncias | **Redis** | `redis` (6379) | Adapter do Socket.IO (fan-out cross-instância) |
| Front-end | **React + Vite (TypeScript)** | `frontend` | Interface de chat responsiva |

**Principais bibliotecas:** `bcryptjs` (hash de senha), `jsonwebtoken` (JWT), `pg`
(PostgreSQL), `mongoose` (MongoDB), `socket.io` + `@socket.io/redis-adapter`
(tempo real escalável), `axios` e `socket.io-client` (front-end e testes).

---

## 3. Arquitetura

```
                         ┌──────────────────────────────┐
                         │      Navegador (cliente)      │
                         └───────────────┬──────────────┘
                                         │  HTTP + WebSocket
                                         ▼
                         ┌──────────────────────────────┐
                         │   NGINX  (gateway / LB)  :8080│
                         └──┬───────────┬───────────┬────┘
            /api/auth, /api/users │     │ /api/conversations (round-robin)
                                  │     │ /socket.io        (least_conn)
                         ▼        │     ▼
                ┌──────────────┐  │   ┌─────────────────┐  ┌─────────────────┐
                │ auth-service │  │   │ chat-service-1  │  │ chat-service-2  │
                │   :4000      │  │   │     :5000       │  │     :5000       │
                └──────┬───────┘  │   └────────┬────────┘  └────────┬────────┘
                       ▼          │            │   Redis Pub/Sub    │
                ┌──────────────┐  │            └─────────┬──────────┘
                │  PostgreSQL  │  │                      ▼
                │  (usuários)  │  │   ┌──────────────┐  ┌──────────┐
                └──────────────┘  │   │   MongoDB    │  │  Redis   │
                                  │   │ (mensagens)  │  │ (adapter)│
                                  ▼   └──────────────┘  └──────────┘
                          ┌──────────────┐
                          │   frontend   │  (SPA React servida por NGINX)
                          └──────────────┘
```

**Integração entre os serviços:** o `auth-service` **assina** um JWT no login; o
`chat-service` **valida** esse mesmo token (segredo `JWT_SECRET` compartilhado). Assim
a autenticação é *stateless* — não há chamada síncrona entre serviços a cada mensagem,
o que favorece a escalabilidade.

---

## 4. Pré-requisitos

- **Docker Desktop** instalado e **em execução** (no Windows, abra o "Docker Desktop").
- Portas livres no host: **8080, 4000, 5432, 27017, 6379**.
- (Opcional, só para rodar testes/serviços fora do Docker) **Node.js 20+**.

Verifique o Docker:
```powershell
docker version
```

---

## 5. Como subir o projeto (instruções exatas)

### 5.1 Subir tudo (primeira vez)

```powershell
# 1. Entrar na pasta do projeto
cd C:\Users\mathe\chat-distribuido

# 2. (opcional) definir o segredo do JWT
copy .env.example .env

# 3. Construir as imagens e subir os 8 containers
docker compose up --build -d

# 4. Conferir o status (todos devem ficar "Up"; bancos "healthy")
docker compose ps
```

Saída esperada do `ps`:
```
SERVICE          STATUS
auth-service     Up
chat-service-1   Up
chat-service-2   Up
frontend         Up
gateway          Up
mongo            Up (healthy)
postgres         Up (healthy)
redis            Up (healthy)
```

### 5.2 Acessar

Abra no navegador: **http://localhost:8080**

### 5.3 Verificação rápida de saúde (smoke test)

```powershell
# Front-end pelo gateway (espera 200)
(Invoke-WebRequest http://localhost:8080/ -UseBasicParsing).StatusCode

# Saúde de cada instância do chat (mostra qual instância respondeu)
docker compose exec -T chat-service-1 wget -qO- http://localhost:5000/health
docker compose exec -T chat-service-2 wget -qO- http://localhost:5000/health
```

### 5.4 Parar / reiniciar

```powershell
docker compose stop            # pausa (mantém dados)
docker compose start           # retoma
docker compose down            # remove containers (mantém volumes/dados)
docker compose down -v         # remove containers E apaga os dados dos bancos
docker compose logs -f         # acompanha todos os logs em tempo real
```

---

## 6. Como usar e validar cada funcionalidade

> **Importante (duas contas ao mesmo tempo):** o login fica no `localStorage`, que é
> compartilhado entre abas normais do mesmo navegador. Para testar **duas contas
> simultâneas**, use **uma janela normal** + **uma janela anônima** (`Ctrl+Shift+N` no
> Chrome) ou **outro navegador/perfil**. Cada conta simultânea precisa de um contexto
> isolado.

### 6.1 Cadastro e login
1. Em http://localhost:8080, aba **Cadastrar**: crie `ana` (senha ≥ 6 caracteres).
2. Numa **janela anônima**, crie `bob`. (Crie `carol` num 3º contexto se for testar grupo.)

### 6.2 Conversa 1:1 (privada)
1. Logado como `ana`, clique em **"+ Nova conversa"** e selecione **apenas o `bob`**.
2. Envie uma mensagem → aparece **instantaneamente** na janela do `bob`.

### 6.3 Conversa 1:N (grupo) — requisito-chave
1. Como `ana`, **"+ Nova conversa"**, selecione **`bob` e `carol`**, dê um **nome ao
   grupo** e crie.
2. Envie uma mensagem no grupo → chega **ao mesmo tempo** para `bob` e `carol`.
   Um único envio, vários destinatários = **1:N**.

### 6.4 Tempo real (digitação e presença)
- Comece a digitar numa janela → a outra mostra **"está digitando…"**.
- O status **online/offline** aparece nos contatos.
  - *Como funciona:* ao conectar, o servidor envia um **snapshot** de quem já está
    online (consultando todas as instâncias via Redis) e, em seguida, novas
    conexões/desconexões são notificadas por *push*. Assim, tanto quem entra primeiro
    quanto quem entra por último enxergam corretamente os usuários online.

### 6.5 Histórico persistido
1. Feche a janela do `bob`, mande mais mensagens pela `ana`.
2. Reabra e logue como `bob` → as mensagens **estão lá** (lidas do MongoDB).

### 6.6 Alta disponibilidade (tolerância a falha)
```powershell
docker compose stop chat-service-1     # derruba uma instância
```
Continue usando o chat no navegador — segue funcionando pela `chat-service-2`.
Depois:
```powershell
docker compose start chat-service-1    # volta a instância
```

### 6.7 Balanceamento de carga / escalabilidade
Num terminal, observe em qual instância cada conexão cai:
```powershell
docker compose logs -f chat-service-1 chat-service-2 | Select-String "connected user"
```
Se `ana` cair na `chat-1` e `bob` na `chat-2` e as mensagens chegarem mesmo assim,
está provada a entrega **entre instâncias via Redis**.

---

## 7. Como o banco de dados armazena os dados

Persistência **poliglota**: cada banco para o tipo de dado mais adequado.

### 7.1 PostgreSQL — usuários (relacional)
Tabela `users` (criada automaticamente no boot — `db/migrate.ts`):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` (PK) | gerado pelo banco (`gen_random_uuid()`) |
| `username` | `text` UNIQUE | não pode repetir |
| `password_hash` | `text` | **hash bcrypt** — a senha nunca é guardada em texto |
| `created_at` | `timestamptz` | data de criação |

No login, o bcrypt compara a senha digitada com o `password_hash`; em caso de sucesso,
o serviço emite um JWT com `{ sub: <id>, username }`.

### 7.2 MongoDB — conversas e mensagens (NoSQL, documentos)

**Collection `conversations`** (`models/Conversation.ts`):
```js
{
  _id:            ObjectId,                 // id da conversa
  type:           "direct" | "group",       // 1:1 ou 1:N
  name:           "Time Backend",           // apenas grupos
  participantIds: ["uuid-ana","uuid-bob"],  // membros (índice)
  lastMessage:    { content, senderId, createdAt },  // prévia p/ a lista
  createdAt, updatedAt
}
```
- Conversas `direct` são **reutilizadas**: ao criar uma DM já existente entre os mesmos
  2 usuários, a mesma conversa é retornada (sem duplicar).
- `participantIds` tem **índice**, acelerando "minhas conversas".

**Collection `messages`** (`models/Message.ts`):
```js
{
  _id:            ObjectId,
  conversationId: "id-da-conversa",   // índice — agrupa o histórico
  senderId:       "uuid-do-remetente",
  senderUsername: "ana",              // desnormalizado p/ exibir sem join
  content:        "olá pessoal!",
  createdAt
}
```

### 7.3 Fluxo de uma mensagem (`message:send`)
Conforme `socket/handlers.ts` + `services/messageService.ts`:
1. **Autoriza** — confere se quem envia é participante (senão erro 403).
2. **Persiste** — grava o documento em `messages`.
3. **Atualiza a conversa** — grava `lastMessage` e `updatedAt` (sobe a conversa na lista).
4. **Faz o broadcast** — emite `message:new` para a sala `user:<id>` de **cada
   participante**; o **Redis adapter** propaga o evento para participantes conectados em
   outras instâncias.

> A mensagem é **gravada antes de ser entregue** — por isso o histórico funciona até
> para quem estava offline na hora.

### 7.4 Inspecionar os bancos diretamente
```powershell
# Usuários (PostgreSQL)
docker compose exec -T postgres psql -U chat -d chatdb -c "SELECT id, username, created_at FROM users;"

# Conversas e contagem de mensagens (MongoDB)
docker compose exec -T mongo mongosh chatdb --quiet --eval "db.conversations.find().limit(5)"
docker compose exec -T mongo mongosh chatdb --quiet --eval "db.messages.countDocuments()"
```

---

## 8. Testes (plano de testes do PDF)

### 8.1 Unitários e de integração por serviço (sem dependências externas)
```powershell
cd C:\Users\mathe\chat-distribuido\services\auth-service
npm install; npm test          # 20 testes (validação de credenciais, JWT, etc.)

cd C:\Users\mathe\chat-distribuido\services\chat-service
npm install; npm test          # 25 testes (persistência de mensagem, tempo real via socket, etc.)
```
- `auth-service`: mocka o repositório → não precisa de Postgres.
- `chat-service`: usa `mongodb-memory-server` → não precisa de Mongo/Redis.

### 8.2 Integração ponta-a-ponta e carga (com a stack no ar)
```powershell
cd C:\Users\mathe\chat-distribuido\load-tests
npm install
npm run e2e      # autentica (auth) e troca mensagens 1:1 e 1:N (chat) + persistência + 403
npm run load     # 12 usuários simultâneos num grupo 1:N (PDF exige >= 10)
npm run lb       # distribui requisições e mostra a divisão entre chat-1 e chat-2
```
Parâmetros: `USERS=20 MSGS=10 npm run load`, `REQUESTS=100 npm run lb`.

---

## 9. Resultados obtidos (execução real)

| Teste | Resultado |
|---|---|
| Unitários auth-service | **20/20** ✓ (≈ 94% de cobertura) |
| Unitários/integração chat-service | **25/25** ✓ (inclui socket em tempo real) |
| Integração ponta-a-ponta (`e2e`) | **16/16** verificações ✓ |
| Carga (`load`) | 12 usuários, **720/720 entregas (100%)**, vazão ≈ **1.513/s**, latência **p50/p95/p99 = 69/111/130 ms** |
| Balanceamento (`lb`) | **20** na chat-1 / **20** na chat-2 ✓ |
| Cross-instância (Redis) | Conexões distribuídas entre as 2 instâncias; fan-out 100% comprovou a entrega entre elas |

---

## 10. Requisitos do PDF × como foram atendidos

| Requisito | Atendimento |
|---|---|
| Microsserviços (≥ 2) | `auth-service` + `chat-service`, independentes |
| Comunicação assíncrona/tempo real | Socket.IO (WebSockets) |
| Banco de dados (≥ 1) | PostgreSQL (usuários) **+** MongoDB (mensagens) |
| Alta disponibilidade | 2 instâncias do chat; falha de uma não derruba o serviço |
| Escalabilidade horizontal | N instâncias + Redis adapter atrás do NGINX |
| Mensagens 1:1 e 1:N | conversas `direct` e `group` |
| Persistência/histórico | mensagens e conversas no MongoDB |
| Front-end responsivo | SPA React (desktop e mobile) |
| Balanceamento de carga | NGINX (round-robin REST + least_conn WebSocket) |
| Testes unitários | auth e chat (validação de login, persistência) |
| Testes de integração | `socket.integration` + `e2e` (auth ⇄ chat ⇄ front) |
| Concorrência/carga (≥ 10) | `load` com 12 usuários simultâneos |

---

## 11. Solução de problemas (troubleshooting)

| Sintoma | Causa provável / solução |
|---|---|
| `failed to connect to the docker API` | Docker Desktop não está rodando — abra o app e aguarde o daemon. |
| Porta 8080/5432/27017 "in use" | Outro processo usa a porta. Pare-o ou ajuste a porta no `docker-compose.yml`. |
| Abrir 2 abas normais loga na mesma conta | `localStorage` é compartilhado entre abas normais. Use janela anônima / outro navegador. |
| Não vejo o outro usuário "online" | O servidor envia um snapshot de presença ao conectar; se ainda assim não aparecer, verifique se as duas instâncias do chat e o Redis estão no ar (`docker compose ps`). |
| Mudei o front-end e não atualizou | Rebuild da imagem: `docker compose up -d --build frontend`. |
| Mudei o `nginx.conf` | É volume montado: `docker compose restart gateway`. |
| Quero zerar tudo | `docker compose down -v` (apaga os dados) e suba de novo. |

---

## 12. Referência rápida de comandos

```powershell
cd C:\Users\mathe\chat-distribuido

docker compose up --build -d                 # subir tudo
docker compose ps                            # status
docker compose logs -f chat-service-1        # logs de uma instância
docker compose stop chat-service-1           # testar alta disponibilidade
docker compose down                          # parar (mantém dados)
docker compose down -v                       # parar e apagar dados

# Testes
cd services/auth-service && npm test
cd services/chat-service && npm test
cd load-tests && npm run e2e && npm run load && npm run lb
```

---

## 13. Estrutura do projeto

```
chat-distribuido/
├── docker-compose.yml          # orquestra os 8 containers
├── nginx/nginx.conf            # gateway + balanceamento de carga
├── docs/
│   ├── GUIA_COMPLETO.md        # este documento
│   ├── RELATORIO.md            # relatório acadêmico (≤5 páginas)
│   └── ARCHITECTURE.md         # contrato técnico (APIs, eventos, modelos)
├── services/
│   ├── auth-service/           # microsserviço de autenticação (Express + PostgreSQL)
│   └── chat-service/           # microsserviço de chat (Socket.IO + MongoDB + Redis)
├── frontend/                   # SPA React + Vite (interface do usuário)
└── load-tests/                 # testes de integração, carga e balanceamento
```
