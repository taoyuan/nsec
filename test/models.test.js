'use strict';

/* global describe,it */
const assert = require('chai').assert;
const modeler = require('../src/modeler');

const s = require('./support');

describe('models', () => {
	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	it('should load models', () => {
		const models = modeler.load();
		assert.ok(models.SecEntity);
		return models.SecEntity.create().then(p => assert.ok(p));
	});
});
