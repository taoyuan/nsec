'use strict';

const assert = require('chai').assert;
const Promise = require('bluebird');
const nsec = require('../');
const s = require('./support');

describe('acl/scoped', () => {
	const acl = nsec(s.ds);

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			acl.scoped().addRole('member'),
			acl.scoped('org:1').addRole('member'),
			acl.scoped('team:1').addRole('member')
		]);
	}

	it('should scoped with all supported scope type', () => {
		let scoped = acl.scoped('123');
		assert.equal(scoped.scope, '123');
		scoped = acl.scoped('1', '2', '3');
		assert.equal(scoped.scope, '1:2:3');
		// eslint-disable-next-line
		scoped = acl.scoped(new Object({id: 123}));
		assert.equal(scoped.scope, '123');
		return s.models.Store.findOne().then(store => {
			scoped = acl.scoped(store);
			assert.equal(scoped.scope, 'Store:' + store.id);
		});
	});

	it('should find roles', () => {
		return addRoles().then(([role]) => {
			return acl.findRoles({where: {scope: null}}).then(roles => {
				assert.equal(roles.length, 1);
				assert.deepEqual(roles[0].toObject(), role.toObject());
			});
		});
	});

	it('should remove role', () => {
		return addRoles()
			.then(() => acl.scoped('*').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 3))

			.then(() => acl.scoped().countRoles({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => acl.scoped('org:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => acl.scoped('team:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => acl.scoped().removeRoles('member'))
			.then(() => acl.countRoles({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => acl.scoped('org:1').removeRoles('member'))
			.then(() => acl.scoped('org:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => acl.scoped('team:1').removeRoles('member'))
			.then(() => acl.scoped('team:1').countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => acl.countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});
});
