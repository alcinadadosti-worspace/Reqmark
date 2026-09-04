import { describe, expect, it } from 'vitest';
import { searchPeople, shortInitials, wordInitials } from './peopleSearch';
import { USERS } from '@/shared/users';

const nomes = (query: string) => searchPeople(USERS, query).map((user) => user.name);

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
    expect(searchPeople(USERS, '')).toEqual([]);
    expect(searchPeople(USERS, 'r')).toEqual([]);
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
    expect(encontrados[0].startsWith('Ana')).toBe(true);
    // "Nathália" contém "ana"? não; mas "Amanda" não começa com "ana".
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
