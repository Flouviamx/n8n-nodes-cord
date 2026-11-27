import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Cord } = require('../dist/nodes/Cord/Cord.node.js');
const { CordTrigger, signatureMatches } = require('../dist/nodes/Cord/CordTrigger.node.js');
const { CordApi } = require('../dist/credentials/CordApi.credentials.js');
const { EVENTS, EVENT_KEYS } = require('../dist/nodes/Cord/events.js');
// The canonical catalog only exists inside the Cord repository; the public repository of the node compares against the copy.
const CANONICAL = new URL('../../zapier/lib/events.js', import.meta.url);
const canonical = existsSync(CANONICAL) ? require(CANONICAL.pathname) : { EVENTS, EVENT_KEYS };
const pkg = require('../package.json');

test('the package declares the files n8n loads', () => {
    for (const file of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) {
        assert.doesNotThrow(() => require(`../${file}`), `n8n could not load ${file}`);
    }
});

test('the event copy matches the canonical catalog', () => {
    assert.deepEqual(EVENTS, canonical.EVENTS, 'run `npm run sync` in integrations/n8n');
    assert.equal(EVENT_KEYS.length, canonical.EVENT_KEYS.length);
});

test('the action node only calls the public Cord API', () => {
    const { description } = new Cord();
    assert.equal(description.requestDefaults.baseURL, 'https://cordhq.app/api/v1');
    assert.deepEqual(description.credentials, [{ name: 'cordApi', required: true }]);
    const urls = JSON.stringify(description.properties).match(/"url":"[^"]+"/g) ?? [];
    for (const url of urls) assert.ok(!url.includes('http'), `absolute URL in ${url}`);
});

test('every operation declares its request', () => {
    const { description } = new Cord();
    const operations = description.properties.filter((p) => p.name === 'operation');
    assert.ok(operations.length >= 3);
    for (const op of operations) {
        for (const option of op.options) {
            assert.ok(option.routing?.request?.method, `${option.value} has no method`);
            assert.ok(option.routing?.request?.url, `${option.value} has no URL`);
        }
    }
});

test('version 2 returns the object, and one item per search result', () => {
    const { description } = new Cord();
    assert.deepEqual(description.version, [1, 2]);
    assert.equal(description.defaultVersion, 2);
    const operations = description.properties.filter((p) => p.name === 'operation');
    for (const op of operations) assert.ok([1, 2].includes(op.displayOptions.show['@version'][0]), 'operation without a version');
    for (const op of operations.filter((o) => o.displayOptions.show['@version'][0] === 2)) {
        for (const option of op.options) {
            assert.deepEqual(option.routing.output.postReceive, [{ type: 'rootProperty', properties: { property: 'data' } }], option.action);
            assert.equal(Boolean(option.routing.operations?.pagination), option.value === 'search', option.action);
        }
    }
    for (const op of operations.filter((o) => o.displayOptions.show['@version'][0] === 1)) {
        for (const option of op.options) assert.equal(option.routing.output, undefined, `version 1 of ${option.action} changed its output`);
    }
    for (const resource of ['client', 'quote']) {
        const names = description.properties.filter((p) => p.displayOptions?.show?.resource?.[0] === resource && p.displayOptions.show.operation?.[0] === 'search').map((p) => p.name);
        assert.ok(names.includes('returnAll') && names.includes('limit'), resource);
    }
});

test('requests match what the API v1 accepts', () => {
    const { description } = new Cord();
    const options = description.properties.filter((p) => p.name === 'operation').flatMap((p) => p.options);
    for (const paid of options.filter((o) => o.value === 'paid')) assert.deepEqual(paid.routing.request.body, { action: 'mark_paid' });
    const quoteSearch = description.properties.filter((p) => p.displayOptions?.show?.resource?.[0] === 'quote' && p.displayOptions.show.operation?.[0] === 'search');
    assert.ok(quoteSearch.some((p) => p.routing?.send?.property === 'folio'), 'the API filters quotes by quote number');
    assert.ok(!quoteSearch.some((p) => p.routing?.send?.property === 'q'), 'the API ignores q on quotes');
    const dueDate = description.properties.find((p) => p.name === 'taskAdditionalFields').options.find((o) => o.name === 'due_date');
    assert.match(dueDate.routing.send.value, /slice\(0, 10\)/, 'the API expects the date as YYYY-MM-DD');
});

test('the trigger offers the same events Cord emits', () => {
    const { description } = new CordTrigger();
    const field = description.properties.find((p) => p.name === 'eventos');
    assert.deepEqual(field.options.map((o) => o.value), canonical.EVENT_KEYS);
    assert.equal(description.webhooks[0].httpMethod, 'POST');
});

test('the credential stores the key as a password and is tested against /me', () => {
    const cred = new CordApi();
    assert.equal(cred.properties[0].typeOptions.password, true);
    assert.equal(cred.test.request.url, '/me');
    assert.match(cred.authenticate.properties.headers.Authorization, /\{\{\$credentials\.apiKey\}\}/);
});

const sign = (secret, ts, body) => crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');

test('a signature is accepted only when it matches, is recent and is not empty', () => {
    const body = JSON.stringify({ event: 'quote.approved' });
    const ts = Math.floor(Date.now() / 1000);
    assert.equal(signatureMatches(body, `t=${ts},v1=${sign('s3cret', ts, body)}`, 's3cret'), true);
    assert.equal(signatureMatches(body, `t=${ts},v1=${sign('other', ts, body)}`, 's3cret'), false);
    assert.equal(signatureMatches(body, `t=${ts},v1=${sign('s3cret', ts, body)}`, ''), false);
    assert.equal(signatureMatches(body + ' ', `t=${ts},v1=${sign('s3cret', ts, body)}`, 's3cret'), false);
    const old = ts - 3600;
    assert.equal(signatureMatches(body, `t=${old},v1=${sign('s3cret', old, body)}`, 's3cret'), false, 'replay of an old delivery');
});

test('during a secret rotation one matching signature is enough', () => {
    const body = JSON.stringify({ event: 'quote.paid' });
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=${sign('new', ts, body)},v1=${sign('old', ts, body)}`;
    assert.equal(signatureMatches(body, header, 'new'), true);
    assert.equal(signatureMatches(body, header, 'old'), true);
    assert.equal(signatureMatches(body, header, 'other'), false);
});
