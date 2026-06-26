# Frontend — Interface do Usuário (Chat Distribuído)

SPA responsiva (React 18 + TypeScript + Vite) que consome o `auth-service` e o
`chat-service` através do gateway NGINX. Consulte
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) para o contrato de API,
eventos Socket.IO e modelos de dados.

## Funcionalidades

- **Login / Registro** (`/login`) com tratamento de erros.
- **Lista de conversas** com prévia da última mensagem, destaque da conversa
  ativa e indicador de presença.
- **Nova conversa**: direta (1:1) ou grupo (1:N) a partir de `GET /api/users`.
- **Visualização de mensagens** com histórico rolável, auto-scroll, separadores
  de dia, bolhas de mensagem e avatares por iniciais.
- **Tempo real** via Socket.IO: `message:new`, `conversation:updated`, `typing`
  e `presence`; emite `message:send`, `conversation:join` e `typing`.
- Status de conexão no cabeçalho (Conectado / Reconectando).
- Layout responsivo estilo messenger (lista OU conversa em telas estreitas).

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | Base da API. **Vazio** (padrão Docker) → mesma origem do gateway (`/api`, `/socket.io`). Em `npm run dev` vazio assume `http://localhost:8080`. |

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:5173  (API em http://localhost:8080)
```

## Build de produção

```bash
npm run build    # gera dist/
npm run preview  # serve o build localmente
```

## Docker

Build multi-stage (`node:20-alpine` → `nginx:1.27-alpine`), serve `dist/` na
porta 80 com fallback de SPA.

```bash
# VITE_API_URL vazio = mesma origem do gateway (recomendado)
docker build -t chat-frontend .

# Ou apontando para um host específico em build-time:
docker build --build-arg VITE_API_URL=https://meu-host -t chat-frontend .
```

## Estrutura

```
src/
  main.tsx, App.tsx, index.css
  lib/        api.ts, socket.ts, env.ts, storage.ts, format.ts
  context/    AuthContext.tsx
  hooks/      useChat.ts
  pages/      LoginPage.tsx, ChatPage.tsx
  components/ ConversationList, MessageView, MessageComposer,
              NewConversationModal, Avatar
  types.ts
```
