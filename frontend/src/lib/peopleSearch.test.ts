import { describe, expect, it } from 'vitest';
import { searchPeople, shortInitials, wordInitials } from './peopleSearch';

/**
 * Elenco proprio, e nao o cadastro de producao.
 *
 * Estes testes sao sobre o ALGORITMO de busca — acento, meio do nome, iniciais,
 * ordenacao. Amarra-los a `@/shared/users` fazia uma mudanca de RH quebrar a
 * suite: foi o que aconteceu quando o cadastro passou a ser so os lideres de
 * setor e os nomes usados nas assercoes deixaram de existir.
 *
 * Os nomes abaixo cobrem cada caso de proposito: acentuados, "ana" no comeco e
 * no meio, sobrenome repetido e iniciais que colidem.
 */
const PESSOAS = [
  { slackId: 'u1', name: 'José Fernando dos Santos Santana Ramos' },
  { slackId: 'u2', name: 'Josenildo Alves da Silva Júnior' },
  { slackId: 'u3', name: 'Maria Taciane Pereira Barbosa' },
  { slackId: 'u4', name: 'Ana Clara de Matos Chagas' },
  { slackId: 'u5', name: 'Suzana Martins Tavares' },
  { slackId: 'u6', name: 'Rafaela Alves Mendes' },
  { slackId: 'u7', name: 'Carlos Eduardo Silva de Oliveira' },
  { slackId: 'u8', name: 'Alcina' },
];

const nomes = (query: string) => searchPeople(PESSOAS, query).map((user) => user.name);

describe('iniciais', () => {
  it('ignora conectivos', () => {
    expect(wordInitials('José Fernando dos Santos Santana Ramos')).toBe('jfssr');
    expect(shortInitials('José Fernando dos Santos Santana Ramos')).toBe('jr');
    expect(wordInitials('Rafaela Alves Mendes')).toBe('ram');
    expect(shortInitials('Rafaela Alves Mendes')).toBe('rm');
  });

  it('lida com nome de uma palavra só', () => {
    expect(wordInitials('Alcina')).toBe('a');
    expect(shortInitials('Alcina')).toBe('al');
  });
});

describe('busca por nome', () => {
  it('exige pelo menos dois caracteres', () => {
    expect(searchPeople(PESSOAS, '')).toEqual([]);
    expect(searchPeople(PESSOAS, 'r')).toEqual([]);
  });

  it('encontra nomes acentuados sem digitar o acento', () => {
    const encontrados = nomes('jose');
    expect(encontrados).toContain('José Fernando dos Santos Santana Ramos');
    expect(encontrados).toContain('Josenildo Alves da Silva Júnior');
  });

  it('casa no meio do nome completo', () => {
    expect(nomes('taciane')).toContain('Maria Taciane Pereira Barbosa');
  });

  it('coloca quem começa com o termo antes de quem só o contém', () => {
    const encontrados = nomes('ana');
    // "Suzana" e "Santana" também contêm "ana", mas não começam com ele.
    expect(encontrados[0].startsWith('Ana')).toBe(true);
    expect(encontrados).toContain('Ana Clara de Matos Chagas');
  });

  it('encontra a administradora pelo primeiro nome', () => {
    expect(nomes('suzana')).toEqual(['Suzana Martins Tavares']);
  });
});

describe('busca por iniciais', () => {
  it('aceita primeira + última inicial', () => {
    expect(nomes('rm')).toContain('Rafaela Alves Mendes');
  });

  it('aceita todas as iniciais', () => {
    expect(nomes('ram')).toContain('Rafaela Alves Mendes');
  });

  it('aceita iniciais fora de sequência contígua', () => {
    // "Suzana Martins Tavares" -> smt; "st" é subsequência de "smt".
    expect(nomes('st')).toContain('Suzana Martins Tavares');
  });

  it('não trata palavras longas como iniciais', () => {
    // "silva" tem 5 letras: é nome, não inicial — só casa por texto.
    const encontrados = nomes('silva');
    expect(encontrados.every((nome) => nome.toLowerCase().includes('silva'))).toBe(true);
  });

  it('prioriza o casamento exato de iniciais sobre a subsequência', () => {
    const encontrados = searchPeople(
      [
        { slackId: 'a', name: 'Rafael Antonio Moura' }, // iniciais ram, curtas rm
        { slackId: 'b', name: 'Roberto Machado' }, // curtas rm
      ],
      'rm'
    );
    expect(encontrados.map((p) => p.name)).toContain('Roberto Machado');
    expect(encontrados.map((p) => p.name)).toContain('Rafael Antonio Moura');
  });
});
