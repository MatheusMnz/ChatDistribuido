# Arquitetura — Sistema de Chat Distribuído

Documento de contrato técnico. Todos os serviços DEVEM respeitar as portas,
variáveis de ambiente e formatos de payload aqui definidos.

## Visão geral

```
                         ┌──────────────────────────────┐
                         │      Navegador (cliente)      │
                         └───────────────┬──────────────┘
                                         │  HTTP + WebSocket
                                         ▼
                         ┌──────────────────────────────┐
                         │   NGINX  (gateway / LB)  :8080│
                         └──┬───────────┬───────────┬────┘
            /api/auth, /api/users │     │ /api/conversations, /socket.io
                         ▼        │     ▼ (round-robin / ip_hash)
                ┌──────────────┐  │   ┌─────────────────┐  ┌─────────────────┐
                │ auth-service │  │   │ chat-service-1  │  │ chat-service-2  │
                │   :4000      │  │   │     :5000       │  │     :5000       │
                └──────┬───────┘  │   └────────┬────────┘  └────────┬────────┘
                       │          │            │      Redis Pub/Sub │
                       ▼          │            └────────┬───────────┘
                ┌──────────────┐  │                     ▼
                │  PostgreSQL  │  │            ┌──────────────┐   ┌──────────┐
                │   (usuários) │  │ /  ──────► │   MongoDB    │   │  Redis   │
                └──────────────┘  │ frontend   │  (mensagens) │   │ (adapter)│
                                  ▼            └──────────────┘   └──────────┘
                          ┌──────────────┐
                          │   frontend   │
                          │  (estático)  │
                          └──────────────┘
```

## Requisitos atendidos

| Requisito do PDF | Como é atendido |
|---|---|
| Microsserviços (>= 2) | `auth-service` (usuários/login) + `chat-service` (mensagens) |
| Comunicação assíncrona/tempo real | Socket.IO (WebSockets) no `chat-service` |
| Banco de dados | PostgreSQL (usuários, relacional) + MongoDB (mensagens, NoSQL) |
| Alta disponibilidade | 2+ instâncias do `chat-service`; falha de uma não derruba o chat |
| Escalabilidade horizontal | N instâncias do `chat-service` atrás do NGINX + Redis adapter |
| Tempo real 1:1 e 1:N | Conversas `direct` e `group` via Socket.IO |
| Persistência/histórico | Mensagens e conversas persistidas no MongoDB |
| Front-end responsivo | SPA React + Vite |
| Balanceamento de carga | NGINX: round-robin (REST) + least_conn (WebSocket) entre instâncias |

## Portas

| Componente | Porta interna | Exposta no host |
|---|---|---|
| nginx (gateway) | 80 | 8080 |
| auth-service | 4000 | 4000 (debug) |
| chat-service-1 / -2 | 5000 | — |
| frontend (nginx estático) | 80 | — |
| postgres | 5432 | 5432 |
| mongo | 27017 | 27017 |
| redis | 6379 | 6379 |

## Variáveis de ambiente (contrato)

Compartilhada: `JWT_SECRET` (auth assina, chat valida — mesmo segredo).

auth-service:
- `PORT=4000`
- `DATABASE_URL=postgres://chat:chat@postgres:5432/chatdb`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=1d`

chat-service:
- `PORT=5000`
- `MONGO_URL=mongodb://mongo:27017/chatdb`
- `REDIS_URL=redis://redis:6379`
- `JWT_SECRET`
- `AUTH_SERVICE_URL=http://auth-service:4000`
- `INSTANCE_ID` (ex.: `chat-1`) — usado em logs/headers para evidenciar o LB.

frontend (build-time):
- `VITE_API_URL=` (vazio → mesma origem do gateway, caminho relativo `/api` e `/socket.io`)

## Contrato REST — auth-service

Base via gateway: `/api/auth` e `/api/users`.

- `POST /api/auth/register` — body `{ "username": string, "password": string }`
  - 201 → `{ "id": string, "username": string }`
  - 409 → `{ "error": "username already taken" }`
- `POST /api/auth/login` — body `{ "username", "password" }`
  - 200 → `{ "token": string, "user": { "id", "username" } }`
  - 401 → `{ "error": "invalid credentials" }`
- `GET /api/auth/me` — header `Authorization: Bearer <token>`
  - 200 → `{ "id", "username" }`
- `GET /api/users` — header `Authorization: Bearer <token>`
  - 200 → `[ { "id", "username" }, ... ]` (todos menos o próprio)
- `GET /health` → `{ "status": "ok" }`

JWT payload: `{ "sub": <userId>, "username": <username> }`.

## Contrato REST — chat-service

Base via gateway: `/api/conversations`. Todas exigem `Authorization: Bearer`.

- `POST /api/conversations` — body
  `{ "type": "direct" | "group", "participantIds": string[], "name"?: string }`
  - 201 → objeto `Conversation`. Para `direct`, reusa conversa existente entre os 2.
- `GET /api/conversations` → `Conversation[]` (conversas do usuário, ordenadas por `updatedAt` desc)
- `GET /api/conversations/:id/messages?limit=50&before=<iso>` → `Message[]` (asc)
- `GET /health` → `{ "status": "ok", "instance": <INSTANCE_ID> }`

### Modelos

```ts
Conversation {
  id: string;
  type: "direct" | "group";
  name?: string;                 // grupos
  participantIds: string[];      // ids de usuário
  lastMessage?: { content: string; senderId: string; createdAt: string };
  createdAt: string;
  updatedAt: string;
}

Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: string;
}
```

## Contrato WebSocket (Socket.IO) — chat-service

Handshake: `io(url, { auth: { token } })`. Conexão rejeitada se JWT inválido.

Eventos cliente → servidor:
- `conversation:join` `{ conversationId }`
- `message:send` `{ conversationId, content }` → persiste e faz broadcast a todos
  os participantes (via Redis adapter, em qualquer instância).
- `typing` `{ conversationId, isTyping }`

Eventos servidor → cliente:
- `message:new` `Message` — nova mensagem em uma conversa do usuário.
- `conversation:updated` `Conversation` — conversa criada/atualizada (ex.: novo grupo).
- `typing` `{ conversationId, userId, username, isTyping }`
- `presence` `{ userId, online: boolean }`

Cada usuário entra na sala `user:<userId>`; cada conversa usa a sala
`conversation:<conversationId>`. O broadcast usa as salas dos participantes para
garantir entrega 1:1 e 1:N independente da instância (Redis Pub/Sub).
