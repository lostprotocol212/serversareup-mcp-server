import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { SAUClient } from '../dist/client.js';
import { handleToolCall } from '../dist/handlers.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const client = new SAUClient('https://serversareup.com', 'sau_scoped_test');
const resultBody = (result) => JSON.parse(result.content[0].text);

test('MCP preserves queued command receipts and polls completion without repeating the mutation', async () => {
  const calls = [];
  const pending = { pending: true, operationId: 'operation/owned', status: 'PROCESSING', pollUrl: '/api/v1/instances/instance-a/game-server/control?operationId=operation%2Fowned' };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json(calls.length === 1 ? pending : { success: false, exitCode: 7, stdout: 'partial', stderr: 'failed', operationId: pending.operationId }, { status: calls.length === 1 ? 202 : 200 });
  };
  const exec = await handleToolCall(client, 'exec_instance', { id: 'instance-a', command: 'false' });
  assert.equal(exec.isError, undefined);
  assert.deepEqual(resultBody(exec), pending);
  const polled = await handleToolCall(client, 'get_game_operation', { id: 'instance-a', operation_id: pending.operationId });
  assert.equal(polled.isError, true);
  assert.equal(resultBody(polled).exitCode, 7);
  assert.equal(calls[1].options.method ?? 'GET', 'GET');
  assert.equal(calls[1].url, 'https://serversareup.com/api/v1/instances/instance-a/game-server/control?operationId=operation%2Fowned');
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  const power = { success: true, pending: true, commandId: 'power-owned', commandStatus: 'PENDING', replayed: false };
  globalThis.fetch = async () => Response.json(power, { status: 202 });
  assert.deepEqual(resultBody(await handleToolCall(client, 'stop_instance', { id: 'instance-a' })), { ...power, message: 'Power action stop accepted' });
});

test('MCP exposes a read-only exact backup quote and explicit permanent cleanup', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ eligible: true }); };
  const quote = await handleToolCall(client, 'quote_backup_policy', { product_slug: 'backup-standard', lineage_id: 'lineage/owned' });
  assert.equal(resultBody(quote).eligible, true);
  assert.equal(calls[0].url, 'https://serversareup.com/api/v1/backups/quote?productSlug=backup-standard&lineageId=lineage%2Fowned');
  assert.equal(calls[0].options.method ?? 'GET', 'GET');
  await handleToolCall(client, 'delete_instance', { id: 'instance/owned' });
  await handleToolCall(client, 'delete_instance', { id: 'instance/owned', permanent: true, idempotency_key: 'delete-owned-1' });
  assert.equal(calls[1].url, 'https://serversareup.com/api/v1/instances/instance%2Fowned');
  assert.equal(calls[2].url, calls[1].url + '?permanent=true');
  assert.equal(calls[2].options.headers['Idempotency-Key'], 'delete-owned-1');
  assert.equal((await handleToolCall(client, 'delete_instance', { id: 'instance', permanent: 'true' })).isError, true);
  assert.equal(calls.length, 3);
});

test('MCP discovers every backup source page with its existing scoped token and no payment mutation', async () => {
  const urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(url);
    assert.equal(options.method ?? 'GET', 'GET');
    assert.equal(options.headers.Authorization, 'Bearer sau_scoped_test');
    return Response.json({ sources: [{ lineageId: `lineage-${urls.length}`, sizeGiB: 40 }], total: 101 });
  };
  const result = await handleToolCall(client, 'list_backup_sources', {});
  assert.deepEqual(resultBody(result).map(source => source.lineageId), ['lineage-1', 'lineage-2']);
  assert.deepEqual(urls, ['https://serversareup.com/api/v1/backups/sources?limit=100&offset=0', 'https://serversareup.com/api/v1/backups/sources?limit=100&offset=100']);
  globalThis.fetch = async () => Response.json({ sources: [] });
  const invalid = await handleToolCall(client, 'list_backup_sources', {});
  assert.equal(invalid.isError, true);
  assert.match(invalid.content[0].text, /Invalid backup source response/);
});

test('MCP purchase, polling, access and file tools preserve the v1 contract and retry key', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.Authorization, 'Bearer sau_scoped_test');
    return Response.json({ orderId: 'order-1', instanceId: 'instance/1' });
  };
  const order = { item: { productSlug: 'linux-basic', configuration: { os: 'ubuntu-24.04' } }, confirm: true, legalAcceptance: { accepted: true } };
  assert.equal(resultBody(await handleToolCall(client, 'create_order', { order, idempotency_key: 'purchase-attempt-1' })).orderId, 'order-1');
  assert.equal(calls[0].url, 'https://serversareup.com/api/v1/orders');
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'purchase-attempt-1');
  assert.deepEqual(JSON.parse(calls[0].options.body), order);
  await handleToolCall(client, 'get_order', { id: 'order-1' });
  await handleToolCall(client, 'get_instance_access', { id: 'instance/1' });
  await handleToolCall(client, 'get_instance_access', { id: 'instance/1', include_credentials: true });
  await handleToolCall(client, 'read_instance_file', { id: 'instance/1', path: '/tmp/a b' });
  await handleToolCall(client, 'write_instance_file', { id: 'instance/1', path: '/tmp/a b', content: 'hello\n' });
  assert.deepEqual(calls.slice(1).map((call) => call.url), [
    'https://serversareup.com/api/v1/orders/order-1',
    'https://serversareup.com/api/v1/instances/instance%2F1/access',
    'https://serversareup.com/api/v1/instances/instance%2F1/access?credentials=true',
    'https://serversareup.com/api/v1/instances/instance%2F1/files?path=%2Ftmp%2Fa%20b',
    'https://serversareup.com/api/v1/instances/instance%2F1/files',
  ]);
  assert.equal(calls[5].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[5].options.body), { path: '/tmp/a b', content: 'hello\n' });
});

test('MCP preserves command failures, API error codes and retry guidance without retrying a purchase', async () => {
  globalThis.fetch = async () => Response.json({ success: false, exitCode: 7, stdout: 'partial', stderr: 'failed' });
  const exec = await handleToolCall(client, 'exec_instance', { id: 'instance-1', command: ['sh', '-c', 'exit 7'] });
  assert.equal(exec.isError, true);
  assert.equal(resultBody(exec).exitCode, 7);
  let count = 0;
  globalThis.fetch = async () => { count++; return Response.json({ code: 'ERR_RATE_LIMIT', error: 'Wait before retrying' }, { status: 429, headers: { 'Retry-After': '15' } }); };
  const purchase = await handleToolCall(client, 'create_order', { order: {}, idempotency_key: 'purchase-attempt-1' });
  assert.equal(purchase.isError, true);
  assert.match(purchase.content[0].text, /ERR_RATE_LIMIT.*retry after 15s/);
  assert.equal(count, 1);
});

test('MCP follows all instance pages and accepts an empty successful deletion', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    if (url.endsWith('/ssh-keys/key-1')) return new Response(null, { status: 204 });
    return Response.json({ instances: [{ id: `instance-${urls.length}`, name: 'Guest', status: 'RUNNING', createdAt: '2026-09-06' }], total: 2 });
  };
  assert.equal((await client.listInstances()).length, 2);
  assert.match(urls[1], /offset=1$/);
  assert.equal((await handleToolCall(client, 'delete_ssh_key', { id: 'key-1' })).isError, undefined);
});
