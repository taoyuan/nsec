'use strict';

const PromiseA = require('bluebird');
const assert = require('chai').assert;
const nsec = require('..');

const s = require('./support');

describe('sec/canable', () => {
	describe('with dirty', () => {
		itCanable(true);
	});

	describe('without dirty', () => {
		itCanable(false);
	});
});

function itCanable(dirty) {
	let sec;
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
		sec = nsec(s.ds, {dirty});
		return s.Product.create().then(p => product = p);
	});

	afterEach(() => s.teardown());

	it('should allow single action', () => {
		return sec.allow(tom, product, 'read').then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [{subject: 'User:' + tom.id, actions: ['read']}]);
		});
	});

	it('should allow multiple actions', () => {
		return sec.allow('tom', product, ['read', 'destroy']).then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [{subject: 'tom', actions: ['read', 'destroy']}]);
		});
	});

	it('should allow multiple subjects', () => {
		return sec.allow(['a', 'b'], product, ['read', 'destroy']).then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [
				{subject: 'a', actions: ['read', 'destroy']},
				{subject: 'b', actions: ['read', 'destroy']}
			]);
		});
	});

	it('should disallow action', () => {
		return sec.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			return sec.disallow(['a', 'b'], product, ['destroy']).then(p => {
				const permissions = dirty ? product._permissions : p.permissions;
				assert.sameDeepMembers(permissions, [{subject: 'a', actions: ['read']}, {
					subject: 'b',
					actions: ['read']
				}]);
			});
		});
	});

	it('should can for all without permissions set', () => {
		assert.eventually.isTrue(sec.can('a', product, 'read'));
	});

	it('should can for all with empty permissions', () => {
		return sec.allow(['a', 'b'], product, []).then(() => {
			assert.eventually.isTrue(sec.can('a', product, 'read'));
		});
	});

	it('should can for all with `*` action permitted', () => {
		return sec.allow(['a', 'b'], product, '*').then(() => {
			assert.eventually.isTrue(sec.can('a', product, 'read'));
		});
	});

	it('should can for all with `all` action permitted', () => {
		return sec.allow(['a', 'b'], product, 'all').then(() => {
			assert.eventually.isTrue(sec.can('a', product, 'read'));
		});
	});

	it('should can for single permitted action', () => {
		return sec.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			assert.eventually.isTrue(sec.can('a', product, 'read'));
		});
	});

	it('should can for multiple permitted actions', () => {
		return sec.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			assert.eventually.isTrue(sec.can('a', product, ['read', 'destroy']));
		});
	});

	it('should `can` not for single un-permitted action', () => {
		return sec.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			assert.eventually.isTrue(sec.cannot('a', product, ['manage']));
		});
	});

	it('should `can` not for multiple un-permitted action', () => {
		return sec.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			assert.eventually.isTrue(sec.cannot('a', product, ['read', 'manage']));
		});
	});

	it('should `can` not for single un-permitted subject', () => {
		return sec.allow(['a', 'b'], product, ['read', 'destroy']).then(() => {
			assert.eventually.isTrue(sec.cannot('c', product, ['read']));
		});
	});

	it('should work for string entity', () => {
		return sec.allow('tom', 'Product', 'read').then(() => {
			return sec.models.SecEntity.findOne({entityType: 'Product'}).then(inst => {
				assert.sameDeepMembers(inst.permissions, [{subject: 'tom', actions: ['read']}]);
			});
		});
	});

	it('should remove permissions for entity', () => {
		return sec.allow('tom', product, 'read').then(p => {
			const permissions = dirty ? product._permissions : p.permissions;
			assert.sameDeepMembers(permissions, [{subject: 'tom', actions: ['read']}]);
			return sec.remove(product).then(result => {
				if (dirty) {
					assert.isNull(result._permissions);
				} else {
					assert.deepEqual(result, {count: 1});
				}
			});
		});
	});
}
