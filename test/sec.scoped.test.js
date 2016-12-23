'use strict';

const assert = require('chai').assert;
const Promise = require('bluebird');
const nsec = require('../');
const s = require('./support');

describe('sec/scoped', () => {
	const sec = nsec(s.ds);

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			sec.scoped().addRole('member'),
			sec.scoped('org:1').addRole('member'),
			sec.scoped('team:1').addRole('member')
		]);
	}

	it('should scoped with all supported scope type', () => {
		let scoped = sec.scoped('123');
		assert.equal(scoped.scope, '123');
		scoped = sec.scoped(123);
		assert.equal(scoped.scope, '123');
		scoped = sec.scoped(1, 2, 3);
		assert.equal(scoped.scope, '1:2:3');
		scoped = sec.scoped('1', '2', '3');
		assert.equal(scoped.scope, '1:2:3');
		// eslint-disable-next-line
		scoped = sec.scoped(new Object({id: 123}));
		assert.equal(scoped.scope, '123');
		return s.models.Store.findOne().then(store => {
			scoped = sec.scoped(store);
			assert.equal(scoped.scope, 'Store:' + store.id);
		});
	});

	it('should find roles', () => {
		return addRoles().then(([role]) => {
			return sec.findRoles({where: {scope: null}}).then(roles => {
				assert.equal(roles.length, 1);
				assert.deepEqual(roles[0].toObject(), role.toObject());
			});
		});
	});

	it('should remove role', () => {
		return addRoles()
			.then(() => sec.scoped('*').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 3))

			.then(() => sec.scoped().countRoles({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => sec.scoped('org:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => sec.scoped('team:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => sec.scoped().removeRoles('member'))
			.then(() => sec.countRoles({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => sec.scoped('org:1').removeRoles('member'))
			.then(() => sec.scoped('org:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => sec.scoped('team:1').removeRoles('member'))
			.then(() => sec.scoped('team:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => sec.countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});
});
