'use strict';

/* global describe,it,beforeEach,afterEach */
const assert = require('chai').assert;
const PromiseA = require('bluebird');
const nsec = require('..');

const s = require('./support');

const {Store} = s.ds.models;

describe('secure', () => {
	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	it('should secure model find', () => {
		const acl = nsec(s.ds, {getCurrentSubjects: () => 'tom'});
		acl.secure(Store);
		return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}, {secure: false})
			.then(([storeA, storeB, storeC]) => {
				return PromiseA.resolve()
					.then(() => acl.allow('jerry', storeA, ['read', 'manage']))
					.then(() => acl.allow('tom', storeB, ['read']))
					.then(() => acl.allow(['tom', 'jerry'], storeC, ['read']));
			})
			.then(() => {
				return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}).then(stores => {
					assert.lengthOf(stores, 2);
					assert.sameDeepMembers(stores.map(s => s.name), ['B', 'C']);
				});
			});
	});
});
