# Contexto do projeto — AM Marketing

> Leia isto antes de mexer no código. O **porquê** de cada decisão está em
> [`DECISIONS.md`](DECISIONS.md); o **como operar e publicar** está no
> [`README.md`](README.md). Aqui fica o estado atual e o que evita retrabalho.

## O que é

App web de requisições dos materiais físicos do Marketing do **Grupo Alcina
Maria** (rede O Boticário/ACQUA em Alagoas, ~110 pessoas): carrinho, tenda,
mesas, cadeiras e bancada de degustação.

Qualquer pessoa se identifica pelo nome, vê o que está livre e abre uma
requisição. **Suzana Martins Tavares** (Slack `U09F9LWM6MC`) aprova ou reprova
pelo Slack ou pelo painel; o solicitante recebe a resposta no app em tempo real
e no Slack.

Restrição que manda em tudo: **custo zero**. Firebase Spark + Render free +
Slack App no workspace pago que a empresa já tem. Nada que peça cartão.

A especificação original está em `PROMPT-app-requisicoes-marketing.md`.

---

## ⚠️ Onde paramos

**O código está pronto e no GitHub. Nada foi publicado ainda.**

Repositório: `alcinadadosti-worspace/Reqmark`, branch `main`.

O **próximo passo** é a seção 5 do README, nesta ordem:

1. **Firebase** — criar projeto, Firestore em `southamerica-east1`,
   **ativar o login anônimo**, `firebase deploy --only firestore`, pegar a
   config web e a service account em base64
2. **Slack** — criar o app pelo `slack-manifest.yaml`, copiar os dois segredos
3. **Render** — um único Web Service (raiz do repo, `npm run render-build`,
   `npm start`, health check `/health`)
4. **Slack → Interactivity** → `https://<servico>.onrender.com/slack/events`
5. **Seed** — `cp .env.example .env`, preencher, `npm run seed`
6. **Monitor** de keep-alive em `/health` a cada 10 min

> **O tropeço nº 1 é esquecer de ativar o login anônimo.** Sem ele o app abre e
> não carrega nada, porque as `firestore.rules` exigem `request.auth != null`.

**Nunca foi testado contra Firebase e Slack reais** — não havia credenciais.
Build, tipos, lint e 39 testes passam; o fluxo ponta a ponta está descrito na
seção 7 do README para validar depois do deploy.

---

## Rodando agora, sem configurar nada

```bash
npm --prefix frontend run dev      # http://localhost:5173
```

Sem as `VITE_FIREBASE_*`, o app entra em **modo demonstração**: dados em
memória (`frontend/src/demo/`), com as 109 pessoas reais e seis requisições
montadas para exercitar o motor de disponibilidade — item esgotado, pré-reserva
concorrente, conflito com aprovada e devolução antecipada. Um selo `DEMO`
aparece no cabeçalho e **qualquer PIN de 4+ dígitos** abre o painel.

As decisões passam pelo **mesmo** motor da produção; só a persistência é falsa.

---

## Arquitetura em três frases

1. O **frontend fala direto com o Firestore** para ler em tempo real e para
   criar requisições e mensagens — assim a experiência não depende do backend
   estar acordado (o Render free dorme em 15 min).
2. O **backend é a ponte com o Slack** e o guardião das ações privilegiadas
   (`/admin/*`); as `firestore.rules` proíbem o cliente de escrever `status`,
   `decision` e `returnedAt`.
3. O app marca no documento o que precisa virar mensagem
   (`notify.adminPending`, `notify.pending`); o backend processa em listeners e
   faz **catch-up no boot**, então nada se perde enquanto ele dorme.

### O coração

`shared/availability.ts` — motor de disponibilidade **puro**, usado pela mesma
função no frontend (pintar o calendário) e no backend (revalidar na aprovação).
39 testes em `frontend/src/lib/*.test.ts`. Se mexer nele, rode os testes.

Regras: pendentes **não** bloqueiam (viram pré-reserva); devolução antecipada
libera a partir do dia da devolução; um período só vale se todos os itens
couberem em todos os dias.

---

## Convenções

| Item | Regra |
| --- | --- |
| Interface, README, commits | **português do Brasil** |
| Código, variáveis, identificadores | inglês |
| Datas | strings `YYYY-MM-DD`; fuso `America/Maceio` |
| Tema | escuro fixo, paleta onyx/dourado |
| Comentários | explicam **por que**, não o que |

**`shared/` é fonte única.** Depois de editar `shared/*.ts`, rode
`npm run sync:shared` na raiz — as cópias em `frontend/src/shared/` e
`backend/src/shared/` são geradas e versionadas.

**React Bits** (`frontend/src/components/reactbits/`) vem do registry oficial
via `npm run reactbits`. `Stepper` e `AnimatedList` foram **customizados**; o
script se recusa a sobrescrevê-los sem `--force`, e o que mudou está anotado no
topo de cada arquivo.

---

## Armadilhas já pagas

- **`VITE_*` são lidas no BUILD**, não na execução. Mudou uma? Refaça o deploy;
  salvar no painel do Render não basta.
- **Um `.env` só, na raiz.** Serve o backend e o build do frontend
  (`vite.config.ts` aponta `envDir` para a raiz). Não recrie os por-pacote.
- **Datas para exibir usam meia-noite local**, não UTC (`toLocalDate` em
  `lib/dates.ts`). No Brasil (UTC−3) a meia-noite UTC de 04/09 é 21h de 03/09, e
  o calendário mostrava o dia anterior.
- **A Cormorant Garamond usa algarismos oldstyle.** Números em `font-display`
  precisam da classe `.tabular` (que pede `lining-nums`), senão "32" sai com os
  dígitos em alturas diferentes.
- **Tiles do mapa não são mais da CARTO** — ela passou a exigir chave e carimba
  "API KEY REQUIRED" no tile. Hoje é o basemap público da Esri, isolado em
  `frontend/src/components/map/tiles.ts`.
- **A lista de pessoas é ordenada no app** com `localeCompare('pt-BR')`, não
  pelo `orderBy('name')` do Firestore (que ordena por bytes e erra com acentos).
- **`npm ci` apaga `node_modules`**: pare o servidor de dev antes, ou o Windows
  bloqueia os arquivos em uso.
- Ao commitar pelo PowerShell, use `git commit -F arquivo.txt`. Here-strings
  quebram com aspas dentro da mensagem.

---

## Comandos

```bash
# Na raiz
npm run sync:shared     # depois de editar shared/*.ts
npm run build           # os dois pacotes
npm run typecheck
npm run lint
npm test                # 39 testes do motor de disponibilidade
npm run seed            # popula o Firestore (idempotente)
npm run render-build    # o que o Render roda
npm start               # sobe tudo (backend + app) de um serviço só

# Dentro de frontend/
npm run dev
npm run icons           # regera favicon e ícones do PWA a partir da logo
npm run reactbits       # rebaixa os componentes do React Bits
```

---

## Estado da qualidade

- ✅ typecheck, lint e build passam nos dois pacotes
- ✅ 39 testes passando
- ✅ nenhum segredo no bundle (`xoxb`/`private_key` ausentes de `dist/`)
- ✅ verificado com Playwright em 1440 px e 360 px, sem erros de console e sem
  rolagem horizontal
- ⚠️ 8 avisos do ESLint (`react-refresh/only-export-components`) — arquivos que
  exportam um componente e um hook/constante. Intencional, não quebra nada.
- ⚠️ Lighthouse **não** foi medido de verdade. O maior chunk é o SDK do Firebase
  (~182 kB gzip), inevitável para tempo real; o resto é code-split por rota.

## Limitação conhecida

Não há autenticação real: a pessoa escolhe o nome e qualquer um pode escolher o
nome de outro. Aceitável para ferramenta interna em workspace fechado, e foi
decisão consciente para não pedir cadastro a ninguém. As regras protegem a
**integridade** (ninguém aprova a própria requisição nem inventa um status), não
a identidade.

Evolução sugerida: *Sign in with Slack* (OIDC, gratuito). O caminho é curto
porque o app inteiro já identifica as pessoas por `slackId` — bastaria trocar a
tela de identidade e endurecer as regras para `request.auth.uid == requesterId`.
