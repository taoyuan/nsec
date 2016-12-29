'use strict';

const PromiseA = require('bluebird');
const assert = require('chai').assert;
const nsec = require('..');

const s = require('./support');

describe('acl/permissible', () => {
	describe('with dirty', () => {
		itPermissible(true);
	});

	describe('without dirty', () => {
		itPermissible(false);
	});
});

function itPermissible(dirty) {
	let acl;
	let product;
	let tom;
	let jerry;

	beforeEach(() => {
		return s.setup().then(() => PromiseA.fromCallback(cb => s.User.create([{
			name: 'Tom'
		}, {
			name: 'Jerry'
		}], cb))).then(([t, j]) => {
			tom = t;
			jerry = j;
		});
	});

	beforeEach(() => {
		acl = nsec(s.ds, {dirty});
		return s.Product.create().then(p => product = p);
	});

	afterEach(() => s.teardown());

	it('should allow single action', () => {
		return acl.allow(tom, product, 'read').then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [{subject: 'User:' + tom.id, actions: ['READ']}]);
		});
	});

	it('should allow multiple actions', () => {
		return acl.allow('tom', product, ['read', 'destroy']).then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [{subject: 'tom', actions: ['READ', 'DESTROY']}]);
		});
	});

	it('should allow multiple subjects', () => {
		return acl.allow(['a', 'b'], product, ['read', 'destroy']).then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [
				{subject: 'a', actions: ['READ', 'DESTROY']},
				{subject: 'b', actions: ['READ', 'DESTROY']}
			]);
		});
	});

	it('should disallow action', () => {
		return acl.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			return acl.disallow(['a', 'b'], product, ['destroy']).then(p => {
				const permissions = dirty ? product._permissions : p.permissions;
				assert.sameDeepMembers(permissions, [{subject: 'a', actions: ['READ']}, {
					subject: 'b',
					actions: ['READ']
				}]);
			});
		});
	});

	it('should hasPermission for all without permissions set', () => {
		return assert.eventually.isTrue(acl.hasPermission('a', product, 'read'));
	});

	it('should hasPermission for all with empty permissions', () => {
		return acl.allow(['a', 'b'], product, []).then(() => {
			return assert.eventually.isTrue(acl.hasPermission('a', product, 'read'));
		});
	});

	it('should hasPermission for all with `*` action permitted', () => {
		return acl.allow(['a', 'b'], product, '*').then(() => {
			return assert.eventually.isTrue(acl.hasPermission('a', product, 'read'));
		});
	});

	it('should hasPermission for all with `all` action permitted', () => {
		return acl.allow(['a', 'b'], product, 'all').then(() => {
			return assert.eventually.isTrue(acl.hasPermission('a', product, 'read'));
		});
	});

	it('should hasPermission for single permitted action', () => {
		return acl.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			return assert.eventually.isTrue(acl.hasPermission('a', product, 'read'));
		});
	});

	it('should hasPermission for multiple permitted actions', () => {
		return acl.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			return assert.eventually.isTrue(acl.hasPermission('a', product, ['read', 'destroy']));
		});
	});

	it('should work for string entity', () => {
		return acl.allow('tom', 'Product', 'read').then(() => {
			return acl.models.SecEntity.findOne({entityType: 'Product'}).then(inst => {
				assert.sameDeepMembers(inst.permissions, [{subject: 'tom', actions: ['READ']}]);
			});
		});
	});

	it('should remove permissions for entity', () => {
		return acl.allow('tom', product, 'read').then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [{subject: 'tom', actions: ['READ']}]);
			return acl.removeEntitiesPermissions(product).then(result => {
				if (dirty) {
					assert.isNull(result._permissions);
				} else {
					assert.deepEqual(result, {count: 1});
				}
			});
		});
	});
}
