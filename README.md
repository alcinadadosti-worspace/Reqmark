# AM Marketing — Requisições de materiais

App web do **Grupo Alcina Maria** para requisitar os itens físicos do Marketing
— carrinho, tenda, mesas, cadeiras e bancada de degustação.

Qualquer pessoa da equipe escolhe o próprio nome, vê o que está livre, consulta
a agenda de cada item e abre uma requisição em um minuto. **Suzana Martins
Tavares** aprova ou reprova pelo Slack ou pelo painel, e a resposta chega na
hora no app e no Slack de quem pediu.

Custo de operação: **zero**. Firebase Spark + Render free + Slack App no
workspace pago que a empresa já tem.

---

## Índice

1. [O que o app faz](#1-o-que-o-app-faz)
2. [Arquitetura](#2-arquitetura)
3. [Estrutura do repositório](#3-estrutura-do-repositório)
4. [Rodando na sua máquina](#4-rodando-na-sua-máquina)
5. [Deploy passo a passo](#5-deploy-passo-a-passo)
6. [Keep-alive: mantendo o backend acordado](#6-keep-alive-mantendo-o-backend-acordado)
7. [Teste ponta a ponta](#7-teste-ponta-a-ponta)
8. [Operação do dia a dia](#8-operação-do-dia-a-dia)
9. [Solução de problemas](#9-solução-de-problemas)
10. [Limitações conhecidas](#10-limitações-conhecidas)

---

## 1. O que o app faz

| Tela | Rota | Para quem |
| --- | --- | --- |
| **Identidade** — escolha o seu nome | `/` | todo mundo |
| **Itens** — catálogo com disponibilidade de hoje | `/itens` | todo mundo |
| **Agenda** — mês e linha do tempo por item | `/agenda` | todo mundo |
| **Nova requisição** — assistente de 5 passos | `/nova` | todo mundo |
| **Minhas requisições** — lista e status | `/requisicoes` | cada um vê as suas |
| **Ticket** — histórico + conversa privada | `/requisicoes/:id` | solicitante e Suzana |
| **Painel** — fila, em uso, itens, configurações | `/admin` | só Suzana, com PIN |

### A regra que sustenta tudo

Para cada item, em cada dia:

```
usado(item, dia)        = soma das quantidades em requisições APROVADAS que cobrem o dia
disponível(item, dia)   = item.quantidade − usado(item, dia)
```

- **Requisições pendentes não bloqueiam.** Elas aparecem como *pré-reserva*
  (aviso amarelo) e entram na análise de conflito da Suzana — quem decide é ela.
- **Devolução antecipada libera o item a partir do dia da devolução.**
- Um período só é válido se **todos** os itens couberem em **todos** os dias.

Essa lógica vive em [`shared/availability.ts`](shared/availability.ts), é pura,
e o **backend reusa exatamente a mesma função** para revalidar no momento da
aprovação. Ela é coberta por 27 testes (`npm test`).

---

## 2. Arquitetura

```
┌──────────────────────────────┐        onSnapshot (tempo real)        ┌──────────────────────┐
│  FRONTEND (React + Vite)     │◄────────────────────────────────────►│  FIRESTORE (Spark)    │
│  Render Static Site          │  cria requisições / mensagens direto  │  users, items,        │
│  Auth anônimo do Firebase    │──────────────────────────────────────►│  requests, settings   │
└──────────────┬───────────────┘                                       └──────────▲───────────┘
               │ /admin/* (PIN → token)                                            │ Admin SDK
               ▼                                                                   │ (listeners + writes)
┌──────────────────────────────┐   chat.postMessage / chat.update      ┌──────────┴───────────┐
│  BACKEND (Node + Slack Bolt) │──────────────────────────────────────►│        SLACK          │
│  Render Web Service (free)   │◄──────────────────────────────────────│  DM da Suzana (botões)│
│  /health  /slack/events      │   interações (botões, modal)          │  DM do solicitante    │
└──────────────────────────────┘                                       └──────────────────────┘
```

**Por que o frontend fala direto com o Firestore.** O Web Service gratuito do
Render dorme depois de 15 minutos sem tráfego e leva ~1 minuto para acordar. Se
o app dependesse dele para ler ou para criar uma requisição, a primeira pessoa
do dia esperaria um minuto olhando para uma tela vazia. Falando direto com o
Firestore, o app está sempre instantâneo — o backend só precisa estar de pé para
o Slack.

**O que só o backend faz.** Aprovar, reprovar, marcar devolução, mexer no
catálogo e nas configurações. As `firestore.rules` proíbem o cliente de escrever
`status`, `decision` e `returnedAt`, então não existe caminho alternativo.

**Como nada se perde quando o backend dorme.** O app marca no próprio documento
o que precisa virar mensagem (`notify.adminPending`, `notify.pending`). Ao
subir, o backend roda um **catch-up** e processa tudo que ficou pendente. A
flag só é apagada depois do envio confirmado.

---

## 3. Estrutura do repositório

```
.
├── shared/                   # fonte da verdade dos tipos e da lógica pura
│   ├── types.ts              #   modelos do Firestore + contratos HTTP
│   ├── dates.ts              #   aritmética de dias (YYYY-MM-DD)
│   └── availability.ts       #   motor de disponibilidade
│
├── frontend/                 # React 18 + Vite + Tailwind (Render Static Site)
│   ├── src/features/         #   identity, catalog, request-wizard, tickets, agenda, admin
│   ├── src/components/       #   ui/ (base), reactbits/ (React Bits), icons/, map/, layout/
│   ├── src/lib/              #   firebase, availability, geocode, dates, api
│   ├── src/shared/           #   cópia gerada de /shared — NÃO editar
│   └── scripts/              #   fetch-reactbits.mjs, generate-icons.mjs
│
├── backend/                  # Node 22 + Slack Bolt (Render Web Service)
│   ├── src/slack/            #   Bolt, Block Kit, handlers de botão e modal
│   ├── src/services/         #   decisões (aprovar/reprovar/devolver)
│   ├── src/routes/admin.ts   #   rotas /admin/* com PIN + token
│   ├── src/watchers.ts       #   listeners do Firestore + catch-up
│   ├── src/shared/           #   cópia gerada de /shared — NÃO editar
│   └── scripts/seed.ts       #   dados iniciais (idempotente)
│
├── firestore.rules           # quem pode ler e escrever o quê
├── firestore.indexes.json    # índices compostos exigidos pelas consultas
├── slack-manifest.yaml       # cria o Slack App pronto
└── DECISIONS.md              # por que o código é assim
```

> **Sobre `src/shared/`:** a fonte é `/shared`. Depois de editar lá, rode
> `npm run sync:shared` na raiz para atualizar as cópias dos dois pacotes. Elas
> são versionadas de propósito, para o build funcionar sem depender do script.

---

## 4. Rodando na sua máquina

### Pré-requisitos

- **Node 20 ou superior** (`node -v`)
- Um projeto Firebase com Firestore e login anônimo (seção 5.1)
- Um Slack App instalado no workspace (seção 5.2) — opcional se você só for
  mexer no frontend

### Instalação

```bash
git clone <url-do-repositorio>
cd ReqMarketing

npm --prefix frontend install
npm --prefix backend install
```

### Variáveis de ambiente

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Preencha os dois arquivos. O `.env.example` de cada pacote explica onde
encontrar cada valor.

### Subindo

Em dois terminais:

```bash
npm --prefix frontend run dev     # http://localhost:5173
npm --prefix backend run dev      # http://localhost:8080
```

> Os botões do Slack **não funcionam em `localhost`**: o Slack precisa alcançar
> a sua máquina por HTTPS público. Para testar as interações localmente, exponha
> a porta 8080 com um túnel (`ngrok http 8080`, por exemplo) e aponte a
> *Request URL* do Slack App para `https://<seu-tunel>/slack/events`. Aprovar e
> reprovar **pelo painel do app** funciona normalmente em localhost.

### Comandos úteis

| Comando (na raiz) | O que faz |
| --- | --- |
| `npm run build` | build dos dois pacotes |
| `npm run typecheck` | TypeScript nos dois pacotes |
| `npm run lint` | ESLint nos dois pacotes |
| `npm test` | testes do motor de disponibilidade |
| `npm run seed` | popula o Firestore (idempotente) |
| `npm run sync:shared` | copia `/shared` para dentro dos pacotes |

| Comando (em `frontend/`) | O que faz |
| --- | --- |
| `npm run icons` | regera favicon e ícones do PWA a partir de `public/logo-am.png` |
| `npm run reactbits` | rebaixa os componentes do React Bits do registry oficial |

---

## 5. Deploy passo a passo

São quatro etapas: **Firebase → Slack → Render → seed**. Reserve uns 40 minutos
na primeira vez.

### 5.1 Firebase (Spark — gratuito, sem cartão)

1. **Criar o projeto**
   [console.firebase.google.com](https://console.firebase.google.com) →
   *Adicionar projeto* → nome `am-marketing` → pode desativar o Google Analytics.

2. **Firestore**
   *Build → Firestore Database → Criar banco de dados*
   → modo **produção**
   → região **`southamerica-east1`** (São Paulo — menor latência para Alagoas).

3. **Login anônimo**
   *Build → Authentication → Get started → Sign-in method →
   **Anônimo** → Ativar*.
   Sem isso o app não lê nada: as regras exigem `request.auth != null`.

4. **Publicar as regras e os índices**

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add            # escolha o projeto criado
   firebase deploy --only firestore
   ```

   Sem a CLI: copie o conteúdo de [`firestore.rules`](firestore.rules) e cole em
   *Firestore → Regras → Publicar*. Os índices de
   [`firestore.indexes.json`](firestore.indexes.json) podem ser criados pelos
   links que o console oferece quando uma consulta falha (veja a seção 9).

5. **Configuração web (para o frontend)**
   *Configurações do projeto → Seus apps → Web (`</>`)* → registre o app.
   Copie os valores para as variáveis `VITE_FIREBASE_*`.

6. **Service account (para o backend)**
   *Configurações do projeto → Contas de serviço → Gerar nova chave privada*.
   Um `.json` é baixado. Converta para base64 em **uma linha**:

   ```bash
   # Linux / macOS
   base64 -w0 caminho/para/serviceAccount.json
   ```

   ```powershell
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("caminho\para\serviceAccount.json"))
   ```

   O resultado vai em `FIREBASE_SERVICE_ACCOUNT_B64`.
   **Apague o `.json` depois** — ele dá acesso total ao projeto.

### 5.2 Slack App

1. [api.slack.com/apps](https://api.slack.com/apps) → *Create New App* →
   **From an app manifest** → escolha o workspace.
2. Cole o conteúdo de [`slack-manifest.yaml`](slack-manifest.yaml) (aba **YAML**).
   Se o backend ainda não estiver no ar, salve mesmo assim — a URL é ajustada no
   passo 5.3.
3. *Install to Workspace* → autorize.
4. Copie:
   - *OAuth & Permissions* → **Bot User OAuth Token** (`xoxb-…`) → `SLACK_BOT_TOKEN`
   - *Basic Information* → **Signing Secret** → `SLACK_SIGNING_SECRET`

O bot pede só dois escopos: `chat:write` (mandar as DMs) e `im:write` (abrir a
conversa com quem nunca falou com ele).

> **Peça para a Suzana mandar um "oi" para o bot AM Marketing uma vez.** Alguns
> workspaces bloqueiam a primeira DM de um app até haver essa interação.

### 5.3 Render — Web Service (backend)

No painel do Render: **New → Web Service** → conecte o repositório do GitHub.

| Campo | Valor |
| --- | --- |
| **Name** | `am-marketing-api` |
| **Language / Runtime** | `Node` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |
| **Health Check Path** | `/health` |
| **Region** | `Oregon` (ou a mais próxima disponível no free) |

Em **Environment → Environment Variables**, adicione:

| Chave | Valor |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `SLACK_BOT_TOKEN` | o `xoxb-…` do passo 5.2 |
| `SLACK_SIGNING_SECRET` | o signing secret do passo 5.2 |
| `FIREBASE_SERVICE_ACCOUNT_B64` | o base64 do passo 5.1.6 |
| `ADMIN_SLACK_ID` | `U09F9LWM6MC` |
| `ADMIN_PIN` | o PIN da Suzana (6+ dígitos) |
| `ADMIN_TOKEN_SECRET` | veja abaixo |
| `APP_URL` | preenchido no passo 5.4 |

Para gerar o `ADMIN_TOKEN_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Faça o deploy. Quando terminar, abra `https://am-marketing-api.onrender.com/health`
— deve responder `{"ok":true,...}`.

**Agora volte ao Slack App** → *Interactivity & Shortcuts* → ative e ponha:

```
https://am-marketing-api.onrender.com/slack/events
```

O Slack valida a URL na hora de salvar; se der erro, confira se o `/health`
está respondendo.

### 5.4 Render — Static Site (frontend)

**New → Static Site** → mesmo repositório.

| Campo | Valor |
| --- | --- |
| **Name** | `am-marketing-app` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm ci && npm run build` |
| **Publish Directory** | `dist` |

Em **Redirects/Rewrites**, adicione **uma** regra — sem ela, abrir
`/requisicoes/abc` direto no navegador dá 404:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | **Rewrite** |

Em **Environment Variables**:

| Chave | Valor |
| --- | --- |
| `NODE_VERSION` | `22` |
| `VITE_FIREBASE_API_KEY` | do passo 5.1.5 |
| `VITE_FIREBASE_AUTH_DOMAIN` | do passo 5.1.5 |
| `VITE_FIREBASE_PROJECT_ID` | do passo 5.1.5 |
| `VITE_FIREBASE_STORAGE_BUCKET` | do passo 5.1.5 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | do passo 5.1.5 |
| `VITE_FIREBASE_APP_ID` | do passo 5.1.5 |
| `VITE_API_URL` | `https://am-marketing-api.onrender.com` (sem barra no fim) |

Deploy. Anote a URL final (algo como
`https://am-marketing-app.onrender.com`).

**Feche o círculo:** volte ao Web Service → *Environment* → preencha
`APP_URL` com essa URL (com `https://`, **sem** barra no final) e salve. O
serviço reinicia sozinho.

`APP_URL` faz duas coisas: restringe o CORS das rotas `/admin/*` e monta os
links "Abrir no app" das mensagens do Slack. Se ficar errada, o painel da
Suzana para de funcionar com erro de CORS.

### 5.5 Seed — dados iniciais

Roda **da sua máquina**, uma vez, apontando para o Firestore de produção:

```bash
cd backend
cp .env.example .env          # preencha com os MESMOS valores do Render
npm run seed
```

O que ele cria:

- **`users`** — as ~110 pessoas do Apêndice A; `U09F9LWM6MC` como `admin`.
- **`items`** — carrinho, tenda 3x3, mesa dobrável, cadeira e bancada.
  Quantidades e características são **provisórias**: a Suzana ajusta no painel.
- **`settings/app`** — cidades frequentes (Penedo, Arapiraca, Palmeira dos
  Índios e Maceió, com coordenadas conferidas no geocoder) e tipos de finalidade.
- **`settings/counters`** — começa em 0. **Nunca é sobrescrito**, para não
  bagunçar a numeração já em uso.

É idempotente: rodar de novo atualiza as pessoas e preserva os itens que já
existem. Para adicionar alguém depois, acrescente em
[`backend/scripts/users.ts`](backend/scripts/users.ts) e rode outra vez.

---

## 6. Keep-alive: mantendo o backend acordado

O Render derruba um Web Service gratuito depois de **15 minutos sem tráfego**, e
voltar leva cerca de **1 minuto**. O Slack, porém, exige resposta em **3
segundos** — um clique em "Aprovar" com o serviço dormindo pode falhar.

O Render dá **750 horas de instância por mês** por workspace. Um mês de 31 dias
tem 744 horas, então **um único** Web Service gratuito cabe acordado 24/7 — mas
só se ele for o único do workspace.

Configure um monitor gratuito batendo em `/health` a cada 10 minutos:

**UptimeRobot** ([uptimerobot.com](https://uptimerobot.com), 50 monitores no
plano gratuito):

1. *Add New Monitor* → tipo **HTTP(s)**
2. URL: `https://am-marketing-api.onrender.com/health`
3. *Monitoring Interval*: **10 minutos**

**cron-job.org** ([cron-job.org](https://cron-job.org), gratuito):
crie um job para a mesma URL, a cada 10 minutos.

O `/health` é de propósito bem leve — **não toca no Firestore** —, porque são
milhares de chamadas por mês e o plano Spark cobra por leitura.

> Mesmo com o monitor, todo card do Slack traz o botão **"🔗 Abrir no app"**.
> É o caminho garantido caso um clique falhe.

---

## 7. Teste ponta a ponta

Depois do deploy, faça este roteiro uma vez:

1. **Abra o app** no celular. Escolha um nome qualquer da lista (não o da
   Suzana). Você deve cair no catálogo com os cinco itens.
2. **Toque num item.** O drawer mostra características e a agenda dos próximos
   90 dias.
3. **Nova requisição** → escolha 1 tenda e 2 mesas → finalidade "Ativação em
   loja" com um texto → cidade "Penedo" (o mapa faz o *fly to* com o pino
   dourado) → um período de 2 dias → **Enviar**.
   ✅ Tela de sucesso com o número `#0001` e confete.
4. **No Slack da Suzana:** chega uma DM `🟡 Nova requisição #0001` com itens,
   finalidade, cidade, período, a seção *Conflitos* e três botões.
   ✅ Você (solicitante) também recebe uma DM curta de confirmação.
5. **Clique em ✅ Aprovar** no Slack.
   ✅ O card se transforma em "✅ Aprovada por Suzana às HH:MM", sem botões.
   ✅ **Sem recarregar**, o app do solicitante mostra o toast de aprovação e o
   ticket vira verde (menos de 2 segundos).
   ✅ O solicitante recebe a DM com a decisão.
6. **Volte ao catálogo.** A tenda agora mostra "Em uso até DD/MM (Penedo)" e o
   anel de disponibilidade caiu.
7. **Abra `/nova` de novo** e escolha a mesma tenda: no calendário, os dias da
   reserva aparecem em vermelho. Tente selecioná-los → o calendário treme e
   explica o conflito com nome e cidade.
8. **Como Suzana** (`/` → nome dela → PIN) → `/admin` → aba **Em uso** →
   **Devolvido**.
   ✅ O item volta a ficar livre imediatamente para todo mundo.
9. **Teste a reprovação:** abra outra requisição e clique em ❌ Reprovar no
   Slack. O modal pede o motivo (obrigatório) e o solicitante recebe o texto.

---

## 8. Operação do dia a dia

### Aprovar ou reprovar (Suzana)

**Pelo Slack** — o caminho mais rápido. A DM traz tudo que importa e três
botões. *Reprovar* abre uma janela pedindo o motivo, que é obrigatório e vai
para o solicitante.

**Pelo app** — `/` → seu nome → PIN → `/admin` → aba **Fila**. Cada card já vem
com a análise de conflito:

| Cor | Significa | O que fazer |
| --- | --- | --- |
| 🟢 Verde | nenhum conflito | aprovar tranquila |
| 🟡 Amarelo | outra pessoa **pendente** quer o mesmo item | você decide quem fica |
| 🔴 Vermelho | conflito com uma reserva **já aprovada** | aprovar exige confirmar |

Aprovar com conflito vermelho pede uma confirmação explícita — nunca acontece
sem querer.

### Cadastrar ou editar um item

`/admin` → aba **Itens** → *Novo item*.

- **Quantidade** é o número de unidades físicas que existem. É ela que define a
  disponibilidade.
- **Ícone**: os cinco marcados com ✨ foram desenhados no traço da logo; o resto
  vem do lucide. Um emoji, se preenchido, substitui o ícone.
- **Características** são livres: cada item define os próprios pares
  (`Dimensões · 3x3 m`, `Montagem · 2 pessoas`).
- **Imagem** só por URL externa — o plano gratuito do Firebase não inclui
  armazenamento de arquivos.
- Para tirar um item de circulação sem perder o histórico, desmarque **Item
  ativo** em vez de remover.

### Marcar uma devolução

`/admin` → aba **Em uso** → **Devolvido**. Libera o item **a partir de hoje**,
mesmo que o período fosse até depois. É o que destrava o item quando a ação
acaba antes do previsto. Requisições atrasadas aparecem destacadas em vermelho.

### Cidades e tipos de finalidade

`/admin` → aba **Configurações**. As cidades passam pelo geocoder ao serem
adicionadas, então já entram com coordenadas — é isso que faz o pino aparecer no
mapa do wizard.

### Trocar de pessoa

Menu do canto superior direito → *Trocar de pessoa*. A escolha fica salva no
navegador de cada aparelho.

---

## 9. Solução de problemas

<details>
<summary><strong>O botão do Slack não fez nada / demorou e falhou</strong></summary>

Quase sempre é **cold start**: o backend estava dormindo e não respondeu nos 3
segundos que o Slack espera.

1. Abra `https://am-marketing-api.onrender.com/health` e espere a resposta
   (~1 min na primeira vez).
2. Volte ao Slack e clique de novo — agora vai.
3. Se pressa: use o botão **🔗 Abrir no app** e decida pelo painel.

**Solução definitiva:** configure o monitor de keep-alive da seção 6. Sem ele,
isso vai acontecer toda manhã.

Nada se perde nesse meio-tempo: ao acordar, o backend roda o *catch-up* e
processa as requisições e mensagens que ficaram pendentes.
</details>

<details>
<summary><strong>O app abre em branco ou diz "não consegui carregar"</strong></summary>

1. **Faltou variável de ambiente.** O app mostra exatamente quais
   `VITE_FIREBASE_*` estão vazias. Preencha no Static Site do Render e refaça o
   deploy (variáveis `VITE_*` entram no bundle **durante o build** — mudar sem
   rebuildar não tem efeito).
2. **Login anônimo desativado.** Firebase → *Authentication → Sign-in method →
   Anônimo → Ativar*.
3. **Regras não publicadas.** Rode `firebase deploy --only firestore`.
</details>

<details>
<summary><strong>Console do navegador: "The query requires an index"</strong></summary>

Falta um índice composto. A mensagem de erro traz um **link direto** que cria o
índice certo — clique, confirme e espere alguns minutos.

Para não repetir isso em outro ambiente, os índices estão em
[`firestore.indexes.json`](firestore.indexes.json); publique com
`firebase deploy --only firestore`.
</details>

<details>
<summary><strong>O painel da Suzana dá erro de CORS ou "sessão expirada"</strong></summary>

- **CORS:** a `APP_URL` do Web Service precisa ser **idêntica** à URL do Static
  Site — com `https://` e **sem** barra no final. Um `/` sobrando já quebra.
- **Sessão expirada:** o token dura 12 horas e vive na aba do navegador. É só
  informar o PIN de novo.
- **"PIN incorreto" mesmo estando certo:** depois de 8 tentativas erradas o
  login trava por 15 minutos, por IP.
</details>

<details>
<summary><strong>A Suzana não recebe as DMs do bot</strong></summary>

1. Confirme que o `ADMIN_SLACK_ID` é `U09F9LWM6MC`.
2. Peça para ela mandar um "oi" para o app **AM Marketing** no Slack — alguns
   workspaces exigem essa primeira interação.
3. Confira nos logs do Render se aparece `falha ao abrir DM` — normalmente é
   token errado ou escopo `im:write` faltando (reinstale o app depois de
   corrigir os escopos).
</details>

<details>
<summary><strong>O seed falhou</strong></summary>

- `FIREBASE_SERVICE_ACCOUNT_B64 não é um base64 válido`: o valor foi quebrado em
  várias linhas. Gere de novo com `base64 -w0` (Linux) ou com o comando
  PowerShell da seção 5.1.6.
- `PERMISSION_DENIED`: a service account é de outro projeto. Baixe a chave do
  projeto certo.
- O seed é idempotente — pode rodar de novo à vontade.
</details>

<details>
<summary><strong>Como confiro que nenhum segredo vazou para o site</strong></summary>

```bash
cd frontend && npm run build
grep -r "xoxb" dist/ ; grep -r "private_key" dist/
```

As duas buscas devem voltar vazias. Só variáveis `VITE_*` entram no bundle, e
nenhuma delas é secreta — a configuração web do Firebase é pública por design;
quem protege os dados são as `firestore.rules`.
</details>

---

## 10. Limitações conhecidas

**Não há autenticação real.** A pessoa escolhe o nome numa lista — qualquer um
pode escolher o nome de outro. É aceitável para uma ferramenta interna de ~110
pessoas num workspace fechado, e foi uma decisão consciente para não pedir
cadastro nem senha a ninguém. As regras do Firestore protegem a **integridade**
dos dados (ninguém aprova a própria requisição nem inventa um status), mas não a
identidade.

**Evolução sugerida:** *Sign in with Slack* (OpenID Connect), que é gratuito e
entrega o Slack ID já autenticado. O caminho é curto porque o app inteiro já
identifica as pessoas por `slackId`. Detalhes em
[`DECISIONS.md`](DECISIONS.md#9-limitação-conhecida-identidade-sem-autenticação-real).

**Outras:**

- Imagens de item apenas por URL externa (o Firebase Storage não faz parte do
  plano Spark para projetos novos).
- Datas têm granularidade de **dia**, sem horário. Duas ações no mesmo dia
  disputam o mesmo item.
- Tema escuro fixo, para preservar a identidade dourada.
- A busca de cidades depende de serviços públicos gratuitos (Photon, com
  Nominatim de reserva). Se os dois estiverem fora do ar, o app deixa digitar o
  nome da cidade sem o pino no mapa.

---

<div align="center">
  <sub>Grupo Alcina Maria · O Boticário / ACQUA · Alagoas</sub>
</div>
