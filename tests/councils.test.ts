/** The server and the website must know the same built-in councils. */
import { describe, expect, it } from 'vitest';
import councils from '../src/config/councils.json';
import { INITIAL_CHAPTERS } from '../src/data/initialData';

describe('Built-in councils', () => {
  it('match the councils the website shows', () => {
    expect(councils.councils.map((c) => [c.id, c.name])).toEqual(INITIAL_CHAPTERS.map((c) => [c.id, c.name]));
  });
});
