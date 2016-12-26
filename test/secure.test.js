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
			});
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
			});
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
			});
	});

	it('should skip secure for admin with userIn in options', () => {
		const acl = nsec(s.ds);
		acl.secure(Store);
		return PromiseA.all([
			acl.addRole({name: 'member'}),
			acl.addRole({name: 'admin'})
		]).then(([member, admin]) => {
			return PromiseA.all([
				acl.assignRolesUsers(member, ['Tom', 'Jerry']),
				acl.assignRolesUsers(admin, ['Sam'])
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
		});
	});
});
