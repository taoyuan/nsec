'use strict';

const assert = require('chai').assert;
const _ = require('lodash');
const Promise = require('bluebird');
const nsec = require('../');
const s = require('./support');

describe('acl/roles', () => {
	const acl = nsec(s.ds);

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			acl.addRole({scope: null, name: 'member'}),
			acl.addRole({scope: 'org:1', name: 'member'}),
			acl.addRole({scope: 'team:1', name: 'member'})
		]);
	}

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

			.then(() => acl.countRoles({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => acl.countRoles({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => acl.countRoles({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => acl.removeRoles({scope: null, name: 'member'}))
			.then(() => acl.countRoles({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => acl.removeRoles({scope: 'org:1', name: 'member'}))
			.then(() => acl.countRoles({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => acl.removeRoles({scope: 'team:1', name: 'member'}))
			.then(() => acl.countRoles({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => acl.countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});

	it('should resolve roles', () => {
		return Promise.all([
			acl.addRole({scope: null, name: 'member'}),
			acl.addRole({scope: 'Store:A', name: 'member'}),
			acl.addRole({scope: 'Store:B', name: 'member'})
		]).then(() => {
			return acl.resolveRoles('member').then(roles => {
				assert.lengthOf(roles, 1);
			});
		});
	});

	it('should inherits from parents', () => {
		const scoped = acl.scoped();
		return Promise.all([
			scoped.addRole('member'),
			scoped.addRole('leader'),
			scoped.addRole('admin')
		]).then(([member, leader, admin]) => {
			return acl.inheritRoleFrom(admin, member)
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id]);
				})
				.then(() => acl.inheritRoleFrom(admin, leader))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				})
				.then(() => acl.uninheritRoleFrom(admin, member))
				.then(role => {
					assert.sameMembers(role.parentIds, [leader.id]);
				})
				.then(() => acl.setRoleInherits(admin, [admin, member, leader]))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				});
		});
	});

	it('should get roles parents', () => {
		return createInheritedRoles(acl.scoped()).then(([A, B, C, D, ABC, BCD]) => {
			return acl.getParentRoles([ABC, BCD]).then(parents => {
				assert.sameDeepMembers(parents.map(p => p.name), ['A', 'B', 'C', 'D']);
			});
		});
	});

	it('should get roles parent ids', () => {
		return createInheritedRoles(acl.scoped()).then(([A, B, C, D, ABC, BCD]) => {
			return acl.getParentRoleIds([ABC, BCD]).then(parentIds => {
				return acl.models.SecRole.find({where: {name: {inq: ['A', 'B', 'C', 'D']}}}).then(parents => {
					assert.sameDeepMembers(parents.map(p => p.id), parentIds);
				});
			});
		});
	});

	it('should recurse parents ', () => {
		return createInheritedRoles(acl.scoped()).then(([A, B, C, D, ABC, BCD, ABCD]) => {
			return acl.recurseParentRoleIds(ABCD).then(parentIds => {
				assert.sameDeepMembers(parentIds, [A, B, C, D, ABC, BCD].map(r => r.id));
			});
		});
	});

	it('should assign one membership', () => {
		const scoped = acl.scoped('Store:123');
		return createInheritedRoles(scoped).then(([A]) => {
			return scoped.assignMembership('Tom', A).then(m => {
				assert.isObject(m);
				assert.containSubset(m, {
					roleId: A.id,
					scope: 'Store',
					scopeId: '123',
					userId: 'Tom',
					state: 'pending'
				});
			});
		});
	});

	it('should assign memberships', () => {
		const scoped = acl.scoped('Store:123');
		return createInheritedRoles(scoped).then(([A]) => {
			return scoped.assignMemberships(['Tom', 'Jerry', 'David'], A).then(mappings => {
				assert.lengthOf(mappings, 3);
				assert.containSubset(mappings, [
					{roleId: A.id, scope: 'Store', scopeId: '123', userId: 'Tom', state: 'pending'},
					{roleId: A.id, scope: 'Store', scopeId: '123', userId: 'Jerry', state: 'pending'},
					{roleId: A.id, scope: 'Store', scopeId: '123', userId: 'David', state: 'pending'}
				]);
			});
		});
	});

	it('should assign memberships with null scope', () => {
		const scoped = acl.scoped();
		return createInheritedRoles(scoped).then(([A]) => {
			return scoped.assignMemberships(['Tom', 'Jerry', 'David'], A).then(mappings => {
				assert.lengthOf(mappings, 3);
				assert.containSubset(mappings, [
					{roleId: A.id, scope: null, scopeId: undefined, userId: 'Tom', state: 'pending'},
					{roleId: A.id, scope: null, scopeId: undefined, userId: 'Jerry', state: 'pending'},
					{roleId: A.id, scope: null, scopeId: undefined, userId: 'David', state: 'pending'}
				]);
			});
		});
	});

	it('should assign membership with state active', () => {
		const scoped = acl.scoped();
		return createInheritedRoles(scoped).then(([A]) => {
			return scoped.assignMemberships(['Tom', 'Jerry', 'David'], A, 'active').then(mappings => {
				assert.lengthOf(mappings, 3);
				assert.containSubset(mappings, [
					{roleId: A.id, scope: null, scopeId: undefined, userId: 'Tom', state: 'active'},
					{roleId: A.id, scope: null, scopeId: undefined, userId: 'Jerry', state: 'active'},
					{roleId: A.id, scope: null, scopeId: undefined, userId: 'David', state: 'active'}
				]);
			});
		});
	});

	it('should assign multiple memberships for same user in different scopes', () => {
		const scoped1 = acl.scoped('Foo:1');
		const scoped2 = acl.scoped('Bar:2');

		return Promise.all([
			createInheritedRoles(scoped1),
			createInheritedRoles(scoped2)
		]).then(([[A1], [A2]]) => {
			return Promise.all([
				scoped1.assignMemberships('Tom', A1),
				scoped2.assignMemberships('Tom', A2),
			]).then(() => acl.scoped('*').findMemberships({user: 'Tom'}))
				.then(memberships => {
					assert.lengthOf(memberships, 2);
					assert.containSubset(memberships, [
						{roleId: A1.id, scope: 'Foo', scopeId: '1', userId: 'Tom', state: 'pending'},
						{roleId: A2.id, scope: 'Bar', scopeId: '2', userId: 'Tom', state: 'pending'},
					]);
				});
		});
	});

	it('should contain only one membership for same user and same scope', () => {
		const scoped = acl.scoped('Foo:1');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return Promise.all([
				scoped.assignMemberships('Tom', A, 'A'),
				scoped.assignMemberships('Tom', B, 'B'),
				scoped.assignMemberships('Tom', C, 'C'),
			]).then(() => acl.scoped('*').findMemberships({user: 'Tom'}))
				.then(memberships => {
					assert.lengthOf(memberships, 1);
					assert.containSubset(memberships[0], {
						userId: 'Tom',
						scope: 'Foo',
						scopeId: '1'
					});
					assert.notEqual(memberships[0].state, 'A');
				});
		});
	});

	it('should reassign membership to change role', () => {
		const scoped = acl.scoped('Store:123');
		return createInheritedRoles(scoped).then(([A, B]) => {
			return Promise.each([
				() => scoped.assignMembership('Tom', A).then(() => {
					return scoped.findMembership({user: 'Tom'}).then(membership => {
						assert.isObject(membership);
						assert.equal(membership.roleId, A.id);
					});
				}),
				() => scoped.assignMembership('Tom', B).then(() => {
					return scoped.findMembership({user: 'Tom'}).then(membership => {
						assert.isObject(membership);
						assert.equal(membership.roleId, B.id);
					});
				})
			], fn => fn());
		});
	});

	it('should unassign memberships', () => {
		const scoped = acl.scoped('Store:123');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assignMemberships('Tom', A).then(() => {
				return scoped.unassignMemberships('Tom', A).then(info => {
					assert.deepEqual(info, {count: 1});
					return acl.models.SecMembership.find().then(mappings => {
						assert.lengthOf(mappings, 0);
					});
				});
			});
		});
	});

	it('should update multiple memberships from state pending to active', () => {
		const scoped = acl.scoped();
		return createInheritedRoles(scoped).then(([A]) => {
			return scoped.assignMemberships(['Tom', 'Jerry', 'David'], A)
				.then(() => scoped.updateMemberships(['Tom', 'Jerry'], {state: 'active'}))
				.then(() => scoped.findMemberships(['Tom', 'Jerry']))
				.then(memberships => {
					assert.lengthOf(memberships, 2);
					assert.containSubset(memberships, [
						{roleId: A.id, scope: null, scopeId: undefined, userId: 'Tom', state: 'active'},
						{roleId: A.id, scope: null, scopeId: undefined, userId: 'Jerry', state: 'active'},
					]);
				});
		});
	});

	it('should find user role mappings', () => {
		const X1 = acl.scoped('X:1');
		const X2 = acl.scoped('X:2');
		const Y3 = acl.scoped('Y:3');
		return Promise.all([
			createInheritedRoles(X1),
			createInheritedRoles(X2),
			createInheritedRoles(Y3)
		]).then(([[X1A, X1B, X1C], [X2A, X2B, X2C], [Y3A, Y3B, Y3C]]) => {
			return Promise.each([
				() => X1.assignMemberships(['Tom', 'Jerry'], X1A),
				() => X1.assignMemberships(['Tom', 'Dean', 'Sam'], X1B),
				() => X1.assignMemberships(['Merlin'], X1C),

				() => X2.assignMemberships(['Tom', 'Jerry'], X2A),
				() => X2.assignMemberships(['Tom', 'Dean', 'Sam'], X2B),
				() => X2.assignMemberships(['Merlin'], X2C),

				() => Y3.assignMemberships(['Tom', 'Jerry'], Y3A),
				() => Y3.assignMemberships(['Tom', 'Dean', 'Sam'], Y3B),
				() => Y3.assignMemberships(['Merlin'], Y3C)
			], fn => fn()).then(() => {
				return acl.scoped('X').findMemberships({user: 'Tom'}).then(mappings => {
					assert.lengthOf(mappings, 2);
					assert.sameDeepMembers(mappings.map(r => r.roleId), [X1B.id, X2B.id]);
				});
			});
		});
	});

	it('should find user roles', () => {
		const X = acl.scoped('X');
		const Y = acl.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.each([
				() => X.assignMemberships(['Tom', 'Jerry'], XA, 'active'),
				() => X.assignMemberships(['Tom', 'Dean', 'Sam'], XB, 'active'),
				() => X.assignMemberships(['Merlin'], XC, 'active'),
				() => Y.assignMemberships(['Tom', 'Jerry'], YA, 'active'),
				() => Y.assignMemberships(['Tom', 'Dean', 'Sam'], YB, 'active'),
				() => Y.assignMemberships(['Merlin'], YC, 'active')
			], fn => fn()).then(() => {
				return X.findUserRoles('Tom').then(roles => {
					assert.lengthOf(roles, 1);
					assert.sameDeepMembers(roles.map(r => r.id), [XB.id]);
				});
			}).then(() => {
				return acl.scoped('*').findUserRoles('Tom').then(roles => {
					assert.lengthOf(roles, 2);
					assert.sameDeepMembers(roles.map(r => r.id), [XB.id, YB.id]);
				});
			});
		});
	});

	it('should find user roles recursively', () => {
		const X = acl.scoped('X');
		const Y = acl.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC, XD, XABC], [YA, YB, YC]]) => {
			return Promise.each([
				() => X.assignMemberships(['Tom', 'Jerry'], XA, 'active'),
				() => X.assignMemberships(['Tom', 'Dean', 'Sam'], XB, 'active'),
				() => X.assignMemberships(['Merlin'], XC, 'active'),
				() => X.assignMemberships(['Merlin'], XABC, 'active'),
				() => Y.assignMemberships(['Tom', 'Jerry'], YA, 'active'),
				() => Y.assignMemberships(['Tom', 'Dean', 'Sam'], YB, 'active'),
				() => Y.assignMemberships(['Merlin'], YC, 'active')
			], fn => fn()).then(() => {
				return X.findUserRoles('Merlin', true).then(roles => {
					assert.lengthOf(roles, 4);
					assert.sameDeepMembers(roles.map(r => r.id), [XA.id, XB.id, XC.id, XABC.id]);
				});
			});
		});
	});

	it('should find role users', () => {
		const X = acl.scoped('X');
		const Y = acl.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.each([
				() => X.assignMemberships(['Tom', 'Jerry'], XA),
				() => X.assignMemberships(['Tom', 'Dean', 'Sam'], XB),
				() => X.assignMemberships(['Merlin'], XC),
				() => Y.assignMemberships(['Tom', 'Jerry'], YA),
				() => Y.assignMemberships(['Tom', 'Dean', 'Sam'], YB),
				() => Y.assignMemberships(['Merlin'], YC)
			], fn => fn()).then(() => {
				return X.findRoleUsers(XB).then(users => {
					assert.lengthOf(users, 3);
					assert.sameDeepMembers(users, ['Tom', 'Dean', 'Sam']);
				});
			}).then(() => {
				return X.findRoleUsers().then(users => {
					assert.lengthOf(users, 5);
					assert.sameDeepMembers(users, ['Tom', 'Jerry', 'Dean', 'Sam', 'Merlin']);
				});
			}).then(() => {
				return X.findRoleUsers('all').then(users => {
					assert.lengthOf(users, 5);
					assert.sameDeepMembers(users, ['Tom', 'Jerry', 'Dean', 'Sam', 'Merlin']);
				});
			}).then(() => {
				return X.findRoleUsers('*').then(users => {
					assert.lengthOf(users, 5);
					assert.sameDeepMembers(users, ['Tom', 'Jerry', 'Dean', 'Sam', 'Merlin']);
				});
			});
		});
	});

	it('should has roles with role id', () => {
		const X = acl.scoped('X');
		const Y = acl.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.each([
				() => X.assignMemberships(['Tom', 'Jerry'], XA),
				() => X.assignMemberships(['Tom', 'Dean', 'Sam'], XB),
				() => X.assignMemberships(['Merlin'], XC),
				() => Y.assignMemberships(['Tom', 'Jerry'], YA),
				() => Y.assignMemberships(['Tom', 'Dean', 'Sam'], YB),
				() => Y.assignMemberships(['Merlin'], YC)
			], fn => fn()).then(() => {
				return Promise.all([
					X.hasRoles('Tom', [XB]),
					X.hasRoles('Tom', [XA, XB]),
					X.hasRoles('Tom', [XA, XB, XC])
				]).then(answer => {
					assert.deepEqual(answer, [true, false, false]);
				});
			});
		});
	});

	it('should has roles with role name', () => {
		const X = acl.scoped('X');
		const Y = acl.scoped('Y');
		return Promise.all([
			createInheritedRoles(X),
			createInheritedRoles(Y)
		]).then(([[XA, XB, XC], [YA, YB, YC]]) => {
			return Promise.each([
				() => X.assignMemberships(['Tom', 'Jerry'], XA),
				() => X.assignMemberships(['Tom', 'Dean', 'Sam'], XB),
				() => X.assignMemberships(['Merlin'], XC),
				() => Y.assignMemberships(['Tom', 'Jerry'], YA),
				() => Y.assignMemberships(['Dean', 'Sam'], YB),
				() => Y.assignMemberships(['Merlin'], YC)
			], fn => fn()).then(() => {
				return Promise.all([
					X.hasRoles('Tom', ['B']),
					X.hasRoles('Tom', ['A', 'B']),
					X.hasRoles('Tom', ['A', 'B', 'C'])
				]).then(answer => {
					assert.deepEqual(answer, [true, false, false]);
				});
			});
		});
	});
});

function createInheritedRoles(acl) {
	if (!acl.isScoped) throw new Error('require scoped roles');
	return Promise.all([
		acl.addRole('A'),
		acl.addRole('B'),
		acl.addRole('C'),
		acl.addRole('D'),
		acl.addRole('ABC'),
		acl.addRole('BCD'),
		acl.addRole('ABCD')
	]).then(roles => {
		const [A, B, C, D, ABC, BCD, ABCD] = roles;
		return Promise.all([
			acl.inheritRoleFrom(ABC, [A, B, C]),
			acl.inheritRoleFrom(BCD, [B, C, D]),
			acl.inheritRoleFrom(ABCD, [ABC, BCD])
		]).thenReturn(roles);
	});
}
