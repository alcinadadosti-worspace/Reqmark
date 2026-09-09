/**
 * Cadastro de pessoas: os lideres de setor do Grupo Alcina Maria.
 *
 * FONTE UNICA, compartilhada pelos dois pacotes:
 *   - o backend usa em `scripts/seed.ts` para popular a colecao `users`;
 *   - o frontend usa no modo demonstracao, para a tela de identidade ter a
 *     lista real.
 *
 * So quem esta aqui pode abrir requisicao. A lista comecou com as ~110 pessoas
 * da empresa e foi reduzida aos responsaveis por setor — sao eles que pedem os
 * materiais do Marketing.
 *
 * `U09F9LWM6MC` (Suzana Martins Tavares) e a administradora, a unica que
 * aprova e reprova; os demais entram como `requester`.
 *
 * Uma pessoa pode responder por mais de um setor (o separador e ` · `).
 *
 * Para mexer no cadastro: edite aqui, rode `npm run sync:shared` na raiz e
 * depois `npm run seed`. Quem sair desta lista e DESATIVADO pelo seed, nao
 * apagado — as requisicoes antigas guardam o nome de quem pediu, e o historico
 * continua legivel.
 */
export interface SeedUser {
  slackId: string;
  name: string;
  /** Setor (ou setores) pelos quais a pessoa responde. */
  sector: string;
}

export const USERS: SeedUser[] = [
  { slackId: 'U07KX76F7D4', name: 'Leidiane Souza', sector: 'Canal Loja' },
  {
    slackId: 'U088B372R40',
    name: 'Mariane Santos Sousa',
    sector: 'Lojas Coruripe, Penedo e Teotônio Vilela · Loja Digital',
  },
  {
    slackId: 'U07L6EAUS75',
    name: 'Maria Taciane Pereira Barbosa',
    sector: 'Lojas Coruripe, Penedo e Teotônio Vilela',
  },
  {
    slackId: 'U087HDEARA9',
    name: 'Kemilly Rafaelly Souza Silva',
    sector: 'Lojas Palmeira dos Índios, São Sebastião e Sustentável Palmeira',
  },
  { slackId: 'U08F9KK0AAG', name: 'Ana Clara de Matos Chagas', sector: 'Salão de Vendas Penedo' },
  { slackId: 'U07LP4JSN9K', name: 'João Antonio Tavares Santos', sector: 'Supervisoras de Base' },
  { slackId: 'U07KPE840MD', name: 'Erick Café Santos Júnior', sector: 'Supervisoras Penedo' },
  {
    slackId: 'U07L4D3EWJW',
    name: 'Jonathan Henrique da Conceição Silva',
    sector: 'VD Palmeira dos Índios',
  },
  { slackId: 'U0895CZ8HU7', name: 'Carlos Eduardo Silva de Oliveira', sector: 'Dados / TI' },
  { slackId: 'U081ZP68CA1', name: 'Tomás Azevedo Santos', sector: 'Financeiro / Administrativo' },
  { slackId: 'U07KP9J5BLP', name: 'Rafaela Alves Mendes', sector: 'Gente e Cultura' },
  { slackId: 'U07KXEJU338', name: 'Alberto Luiz Marinho Batista', sector: 'Logística' },
  { slackId: 'U09F9LWM6MC', name: 'Suzana Martins Tavares', sector: 'Marketing' },
];
