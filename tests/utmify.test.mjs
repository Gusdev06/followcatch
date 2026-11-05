import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrder, cleanTracking, sendUtmifyOrder, utmifyDate } from '../server/utmify.ts';

// Mapeamento do pedido e envio com fetch falso: nada sai da máquina.
const base = {
  orderId: 'in_1',
  status: 'paid',
  createdAt: new Date('2026-11-05T01:02:03.000Z'),
  approvedAt: new Date('2026-11-05T01:02:09.000Z'),
  email: 'a@b.test',
  name: 'Ana',
  country: 'US',
  ip: '203.0.113.7',
  productId: 'price_1',
  productName: 'FollowCatch Premium (weekly)',
  planId: 'premium_weekly',
  planName: 'Premium weekly',
  amountCents: 1400,
  feeCents: 71,
  currency: 'usd',
  tracking: { utm_source: 'instagram', utm_campaign: 'bio' },
  isTest: true,
};

afterEach(() => {
  mock.restoreAll();
  delete process.env.UTMIFY_API_TOKEN;
});

test('data vai em UTC no formato da UTMify', () => {
  assert.equal(utmifyDate(new Date('2026-11-05T23:59:58.900Z')), '2026-11-05 23:59:58');
});

test('cleanTracking mantém só chaves conhecidas, texto, sem controle e curto', () => {
  const out = cleanTracking({ utm_source: ' ig\n ', utm_term: 'x'.repeat(300), evil: 'y', sck: 5, src: '   ' });
  assert.deepEqual(Object.keys(out).sort(), ['utm_source', 'utm_term']);
  assert.equal(out.utm_source, 'ig');
  assert.equal(out.utm_term.length, 200);
  assert.deepEqual(cleanTracking('nada'), {});
});

test('pedido pago: comissão líquida, moeda em maiúsculas e UTM ausente vira null', () => {
  const o = buildOrder(base);
  assert.equal(o.status, 'paid');
  assert.equal(o.refundedAt, null);
  assert.deepEqual(o.commission, { totalPriceInCents: 1400, gatewayFeeInCents: 71, userCommissionInCents: 1329, currency: 'USD' });
  assert.equal(o.trackingParameters.utm_source, 'instagram');
  assert.equal(o.trackingParameters.utm_medium, null);
  assert.equal(o.products[0].priceInCents, 1400);
  assert.equal(o.customer.ip, '203.0.113.7');
});

test('reembolso mantém o mesmo orderId e a data de aprovação', () => {
  const o = buildOrder({ ...base, status: 'refunded', refundedAt: new Date('2026-11-06T00:00:00.000Z') });
  assert.equal(o.orderId, 'in_1');
  assert.equal(o.approvedDate, '2026-11-05 01:02:09');
  assert.equal(o.refundedAt, '2026-11-06 00:00:00');
});

test('sem token não chama a rede', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('{}'));
  assert.equal(await sendUtmifyOrder(buildOrder(base)), false);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('com token envia no cabeçalho x-api-token', async () => {
  process.env.UTMIFY_API_TOKEN = 'tok';
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('{"OK":true}'));
  assert.equal(await sendUtmifyOrder(buildOrder(base)), true);
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'https://api.utmify.com.br/api-credentials/orders');
  assert.equal(init.headers['x-api-token'], 'tok');
  assert.equal(JSON.parse(init.body).orderId, 'in_1');
});

test('resposta de erro lança para a Stripe reenviar o evento', async () => {
  process.env.UTMIFY_API_TOKEN = 'tok';
  mock.method(globalThis, 'fetch', async () => new Response('fora', { status: 500 }));
  await assert.rejects(sendUtmifyOrder(buildOrder(base)), /UTMify paid 500/);
});
