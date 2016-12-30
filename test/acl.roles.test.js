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

	it('should assign user roles', () => {
		const scoped = acl.scoped('Store:123');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assignRolesUsers([A, B, C], 'Tom').then(mappings => {
				assert.lengthOf(mappings, 3);
				assert.sameDeepMembers(mappings.map(m => _.omit(m.toJSON(), 'id')), [
					{roleId: A.id, scope: 'Store', scopeId: '123', userId: 'Tom', state: 'active'},
					{roleId: B.id, scope: 'Store', scopeId: '123', userId: 'Tom', state: 'active'},
					{roleId: C.id, scope: 'Store', scopeId: '123', userId: 'Tom', state: 'active'}
				]);
			});
		});
	});

	it('should assign user roles with null scope', () => {
		const scoped = acl.scoped();
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assignRolesUsers([A, B, C], 'Tom').then(mappings => {
				assert.lengthOf(mappings, 3);
				assert.sameDeepMembers(mappings.map(m => _.omit(m.toObject(), 'id')), [
					{roleId: A.id, scope: null, scopeId: undefined, userId: 'Tom', state: 'active'},
					{roleId: B.id, scope: null, scopeId: undefined, userId: 'Tom', state: 'active'},
					{roleId: C.id, scope: null, scopeId: undefined, userId: 'Tom', state: 'active'}
				]);
			});
		});
	});

	it('should unassign user roles', () => {
		const scoped = acl.scoped('Store:123');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assignRolesUsers([A, B, C], 'Tom').then(() => {
				return scoped.unassignRolesUsers(A, 'Tom').then(info => {
					assert.deepEqual(info, {count: 1});
					return acl.models.SecRoleMapping.find().then(mappings => {
						assert.sameDeepMembers(mappings.map(m => _.omit(m.toObject(), 'id')), [
							{roleId: B.id, scope: 'Store', scopeId: '123', userId: 'Tom', state: 'active'},
							{roleId: C.id, scope: 'Store', scopeId: '123', userId: 'Tom', state: 'active'}
						]);
					});
				});
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
			return Promise.all([
				X1.assignRolesUsers(X1A, ['Tom', 'Jerry']),
				X1.assignRolesUsers(X1B, ['Tom', 'Dean', 'Sam']),
				X1.assignRolesUsers(X1C, ['Merlin']),

				X2.assignRolesUsers(X2A, ['Tom', 'Jerry']),
				X2.assignRolesUsers(X2B, ['Tom', 'Dean', 'Sam']),
				X2.assignRolesUsers(X2C, ['Merlin']),

				Y3.assignRolesUsers(Y3A, ['Tom', 'Jerry']),
				Y3.assignRolesUsers(Y3B, ['Tom', 'Dean', 'Sam']),
				Y3.assignRolesUsers(Y3C, ['Merlin'])
			]).then(() => {
				return acl.scoped('X').findUserRoleMappings('Tom').then(mappings => {
					assert.lengthOf(mappings, 4);
					assert.sameDeepMembers(mappings.map(r => r.roleId), [X1A.id, X1B.id, X2A.id, X2B.id]);
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
			return Promise.all([
				X.assignRolesUsers(XA, ['Tom', 'Jerry']),
				X.assignRolesUsers(XB, ['Tom', 'Dean', 'Sam']),
				X.assignRolesUsers(XC, ['Merlin']),
				Y.assignRolesUsers(YA, ['Tom', 'Jerry']),
				Y.assignRolesUsers(YB, ['Tom', 'Dean', 'Sam']),
				Y.assignRolesUsers(YC, ['Merlin'])
			]).then(() => {
				return X.findUserRoles('Tom').then(roles => {
					assert.lengthOf(roles, 2);
					assert.sameDeepMembers(roles.map(r => r.id), [XA.id, XB.id]);
				});
			}).then(() => {
				return acl.scoped('*').findUserRoles('Tom').then(roles => {
					assert.lengthOf(roles, 4);
					assert.sameDeepMembers(roles.map(r => r.id), [XA.id, XB.id, YA.id, YB.id]);
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
			return Promise.all([
				X.assignRolesUsers(XA, ['Tom', 'Jerry']),
				X.assignRolesUsers(XB, ['Tom', 'Dean', 'Sam']),
				X.assignRolesUsers(XC, ['Merlin']),
				X.assignRolesUsers(XABC, ['Merlin']),
				Y.assignRolesUsers(YA, ['Tom', 'Jerry']),
				Y.assignRolesUsers(YB, ['Tom', 'Dean', 'Sam']),
				Y.assignRolesUsers(YC, ['Merlin'])
			]).then(() => {
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
			return Promise.all([
				X.assignRolesUsers(XA, ['Tom', 'Jerry']),
				X.assignRolesUsers(XB, ['Tom', 'Dean', 'Sam']),
				X.assignRolesUsers(XC, ['Merlin']),
				Y.assignRolesUsers(YA, ['Tom', 'Jerry']),
				Y.assignRolesUsers(YB, ['Tom', 'Dean', 'Sam']),
				Y.assignRolesUsers(YC, ['Merlin'])
			]).then(() => {
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
			return Promise.all([
				X.assignRolesUsers(XA, ['Tom', 'Jerry']),
				X.assignRolesUsers(XB, ['Tom', 'Dean', 'Sam']),
				X.assignRolesUsers(XC, ['Merlin']),
				Y.assignRolesUsers(YA, ['Tom', 'Jerry']),
				Y.assignRolesUsers(YB, ['Tom', 'Dean', 'Sam']),
				Y.assignRolesUsers(YC, ['Merlin'])
			]).then(() => {
				return Promise.all([
					X.hasRoles('Tom', [XA, XB]),
					X.hasRoles('Tom', [XA, XB, XC])
				]).then(answer => {
					assert.deepEqual(answer, [true, false]);
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
			return Promise.all([
				X.assignRolesUsers(XA, ['Tom', 'Jerry']),
				X.assignRolesUsers(XB, ['Tom', 'Dean', 'Sam']),
				X.assignRolesUsers(XC, ['Merlin']),
				Y.assignRolesUsers(YA, ['Tom', 'Jerry']),
				Y.assignRolesUsers(YB, ['Dean', 'Sam']),
				Y.assignRolesUsers(YC, ['Merlin'])
			]).then(() => {
				return Promise.all([
					X.hasRoles('Tom', ['A', 'B']),
					X.hasRoles('Tom', ['A', 'B', 'C'])
				]).then(answer => {
					assert.deepEqual(answer, [true, false]);
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
