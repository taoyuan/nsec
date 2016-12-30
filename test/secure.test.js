'use strict';

/* global describe,it,beforeEach,afterEach */
const assert = require('chai').assert;
const PromiseA = require('bluebird');
const nsec = require('..');

const s = require('./support');

const {Store} = s.ds.models;

describe('secure', () => {
	beforeEach(() => {
		return s.setup();
	});
	afterEach(() => {
		return s.teardown();
	});

	it('should secure model with default secure', () => {
		const acl = nsec(s.ds, {getCurrentSubjects: () => 'tom'});
		acl.secure(Store);
		return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}, {secure: false})
			.then(([storeA, storeB, storeC]) => {
				return PromiseA.resolve()
					.then(() => acl.allow('jerry', storeA, ['read', 'manage']))
					.then(() => acl.allow(['tom', 'jerry'], storeC, []));
			})
			.then(() => {
				return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}).then(stores => {
					assert.lengthOf(stores, 2);
					assert.sameDeepMembers(stores.map(s => s.name), ['B', 'C']);
				});
			})
			.finally(() => acl.unsecure(Store));
	});

	it('should secure model without default secure', () => {
		const acl = nsec(s.ds, {getCurrentSubjects: () => 'tom'});
		acl.secure(Store, {secure: false});
		return Store.find({where: {name: {inq: ['A', 'B', 'C']}}})
			.then(([storeA, storeB, storeC]) => {
				return PromiseA.resolve()
					.then(() => acl.allow('jerry', storeA, ['read', 'manage']))
					.then(() => acl.allow('tom', storeB, ['read']))
					.then(() => acl.allow(['tom', 'jerry'], storeC, ['read']));
			})
			.then(() => {
				return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}, {secure: true}).then(stores => {
					assert.lengthOf(stores, 2);
					assert.sameDeepMembers(stores.map(s => s.name), ['B', 'C']);
				});
			})
			.finally(() => acl.unsecure(Store));
	});

	it('should skip secure for admin with getCurrentSubjects', () => {
		const acl = nsec(s.ds, {getCurrentSubjects: () => 'admin'});
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
					assert.lengthOf(stores, 3);
					assert.sameDeepMembers(stores.map(s => s.name), ['A', 'B', 'C']);
				});
			})
			.finally(() => acl.unsecure(Store));
	});

	it('should skip secure for admin with userIn in options', () => {
		const acl = nsec(s.ds);
		acl.secure(Store);
		return PromiseA.all([
			acl.addRole({name: 'member'}),
			acl.addRole({name: 'admin'})
		]).then(([member, admin]) => {
			return PromiseA.all([
				acl.assignMemberships(['Tom', 'Jerry'], member),
				acl.assignMemberships(['Sam'], admin)
			]).then(() => {
				return Store.find({where: {name: {inq: ['A', 'B', 'C']}}})
					.then(([storeA, storeB, storeC]) => {
						return PromiseA.resolve()
							.then(() => acl.allow('Tom', storeA, ['read', 'manage']))
							.then(() => acl.allow('Jerry', storeB, ['read']))
							.then(() => acl.allow(['Sam', 'Tom'], storeC, ['read']));
					})
					.then(() => {
						return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}, {userId: 'Sam'}).then(stores => {
							assert.lengthOf(stores, 3);
							assert.sameDeepMembers(stores.map(s => s.name), ['A', 'B', 'C']);
						});
					});
			});
		}).finally(() => acl.unsecure(Store));
	});

	it('should remove subject permission from models', () => {
		const acl = nsec(s.ds);
		acl.secure(Store);
		return Store.find({where: {name: {inq: ['A', 'B', 'C']}}})
			.then(([storeA, storeB, storeC]) => {
				return PromiseA.resolve()
					.then(() => acl.allow('jerry', storeA, ['read', 'manage']))
					.then(() => acl.allow(['tom', 'jerry'], storeC, ['write']));
			})
			.then(() => {
				return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}, {userId: 'tom'}).then(stores => {
					assert.lengthOf(stores, 2);
					assert.sameDeepMembers(stores.map(s => s.name), ['B', 'C']);
				});
			})
			.then(() => acl.removeSubjectsPermissions('tom').then(result => {
				assert.sameDeepMembers(result, [{count: 1}]);
			}))
			.then(() => {
				return Store.find({where: {name: {inq: ['A', 'B', 'C']}}}, {userId: 'tom'}).then(stores => {
					assert.lengthOf(stores, 1);
					assert.sameDeepMembers(stores.map(s => s.name), ['B']);
				});
			})
			.finally(() => acl.unsecure(Store));
	});

	it('should ignore secure default when the request is being made against a single model instance', () => {
		const acl = nsec(s.ds);
		acl.secure(Store);
		return Store.find({where: {name: {inq: ['A', 'B', 'C']}}})
			.then(([storeA, storeB, storeC]) => {
				return PromiseA.resolve()
					.then(() => acl.allow('jerry', storeA, ['read', 'manage']))
					.then(() => acl.allow(['tom', 'jerry'], storeC, ['write']));
			})
			.then(() => {
				return Store.findById('A', {}, {userId: 'tom'}).then(store => {
					assert.ok(store);
					assert.equal(store.name, 'A');
				});
			})
			.finally(() => acl.unsecure(Store));
	});

	it('should apply secure for "secure=true" when the request is being made against a single model instance', () => {
		const acl = nsec(s.ds);
		acl.secure(Store);
		return Store.find({where: {name: {inq: ['A', 'B', 'C']}}})
			.then(([storeA, storeB, storeC]) => {
				return PromiseA.resolve()
					.then(() => acl.allow('jerry', storeA, ['read', 'manage']))
					.then(() => acl.allow(['tom', 'jerry'], storeC, ['write']));
			})
			.then(() => {
				return Store.findById('A', {}, {userId: 'tom', secure: true}).then(store => {
					assert.notOk(store);
				});
			})
			.finally(() => acl.unsecure(Store));
	});
});
