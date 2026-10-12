import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorized,denied} from './auth.mjs';
const req=authorization=>new Request('https://example.com/api/ingest',{headers:authorization?{authorization}:{}});
test('missing secrets and forged ChatGPT headers cannot grant access',async()=>{
  assert.equal(await authorized(req(),{}),false);
  assert.equal(await authorized(new Request('https://example.com',{headers:{'oai-authenticated-user-id':'owner'}}),{}),false);
  assert.equal(denied().status,401);
});
test('owner login and collector token require exact matching secrets',async()=>{
  const env={OWNER_USERNAME:'owner',OWNER_PASSWORD:'test-password',INGEST_TOKEN:'test-token'};
  assert.equal(await authorized(req('Basic '+btoa('owner:test-password')),env),true);
  assert.equal(await authorized(req('Basic '+btoa('owner:wrong')),env),false);
  assert.equal(await authorized(req('Bearer test-token'),env),true);
  assert.equal(await authorized(req('Bearer test-token-extra'),env),false);
  assert.equal(await authorized(req('Basic !!!'),env),false);
});
