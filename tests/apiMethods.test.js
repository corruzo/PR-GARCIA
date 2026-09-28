import assert from 'node:assert/strict';
import test from 'node:test';
import bcvHandler from '../api/bcv.js';
import latestHandler from '../api/bcv/latest.js';

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

for (const [name, handler] of [['rate', bcvHandler], ['latest rate', latestHandler]]) {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    test(`${name} endpoint rejects ${method}`, async () => {
    const response = createResponse();

    await handler({ method, headers: {} }, response);

    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, 'GET');
    assert.equal(response.payload.ok, false);
    });
  }
}