import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTORS, LIST_SIZE, toList } from '../server/providers/apify.ts';

// Formato do scraping_solutions~instagram-scraper-followers-following-no-cookies (conferido em 04/11/2026).
const item = (username, extra = {}) => ({
  username_scrape: 'alvo',
  type: 'Followings',
  id: String(Math.random()),
  username,
  full_name: `Nome ${username}`,
  is_private: false,
  is_verified: false,
  profile_pic_url: `https://scontent.cdninstagram.com/${username}.jpg`,
  ...extra,
});

test('toList mantém a ordem do dataset (recência) e normaliza os campos', () => {
  const list = toList([item('Mais_Recente', { is_verified: true }), item('segundo'), item('terceiro', { is_private: true })], 'alvo');
  assert.deepEqual(list.map((m) => m.username), ['mais_recente', 'segundo', 'terceiro']);
  assert.equal(list[0].fullName, 'Nome Mais_Recente');
  assert.equal(list[0].verified, true);
  assert.equal(list[2].private, true);
  assert.match(list[1].picUrl, /segundo\.jpg$/);
});

test('toList descarta itens de outro alvo, duplicados e o próprio alvo', () => {
  const list = toList([item('a'), item('b', { username_scrape: 'outro' }), item('a'), item('alvo'), item('c')], 'alvo');
  assert.deepEqual(list.map((m) => m.username), ['a', 'c']);
});

test('input das listas pede LIST_SIZE itens do tipo certo', () => {
  assert.ok(LIST_SIZE >= 25, 'o actor recusa resultsLimit abaixo de 25');
  assert.deepEqual(ACTORS.following.input('x'), { Account: ['x'], resultsLimit: LIST_SIZE, dataToScrape: 'Followings' });
  assert.deepEqual(ACTORS.followers.input('x'), { Account: ['x'], resultsLimit: LIST_SIZE, dataToScrape: 'Followers' });
  assert.ok(ACTORS.following.cost(LIST_SIZE) <= ACTORS.following.maxChargeUsd);
});
