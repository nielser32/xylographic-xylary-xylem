const test = require('node:test');
const assert = require('node:assert');

const app = require('../src/server');

test('server exports an express application', () => {
  assert.strictEqual(typeof app, 'function');
  assert.strictEqual(typeof app.listen, 'function');
});
