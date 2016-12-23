'use strict';

/* global describe,it,beforeEach,afterEach */
const assert = require('chai').assert;
const PromiseA = require('bluebird');
const Canable = require('..');

const s = require('./support');

const {Store} = s.ds.models;

describe('secure', () => {
	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	it('should secure model find', () => {
		const canable = new Canable({ds: s.ds, getCurrentSubjects: () => 'tom'});
		canable.secure(Store);
		return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}).then(([storeA, storeB, storeC]) => {
			return PromiseA.resolve()
				.then(() => canable.allow('jerry', storeA, ['read', 'manage']))
				.then(() => canable.allow('tom', storeB, ['read']))
				.then(() => canable.allow(['tom', 'jerry'], storeC, ['read']));
		}).then(() => {
			return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}).then(stores => {
				assert.lengthOf(stores, 2);
			});
		});
	});
});
