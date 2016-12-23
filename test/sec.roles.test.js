'use strict';

const assert = require('chai').assert;
const _ = require('lodash');
const Promise = require('bluebird');
const nsec = require('../');
const s = require('./support');

describe('sec/roles', () => {
	const sec = nsec(s.ds);

	beforeEach(() => s.setup());
	afterEach(() => s.teardown());

	function addRoles() {
		return Promise.all([
			sec.addRole({scope: null, name: 'member'}),
			sec.addRole({scope: 'org:1', name: 'member'}),
			sec.addRole({scope: 'team:1', name: 'member'})
		]);
	}

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

			.then(() => sec.countRoles({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => sec.countRoles({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 1))
			.then(() => sec.countRoles({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 1))

			.then(() => sec.removeRoles({scope: null, name: 'member'}))
			.then(() => sec.countRoles({scope: null, name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => sec.removeRoles({scope: 'org:1', name: 'member'}))
			.then(() => sec.countRoles({scope: 'org:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => sec.removeRoles({scope: 'team:1', name: 'member'}))
			.then(() => sec.countRoles({scope: 'team:1', name: 'member'}))
			.then(count => assert.equal(count, 0))

			.then(() => sec.countRoles({name: 'member'}))
			.then(count => assert.equal(count, 0));
	});

	it('should inherits from parents', () => {
		const scoped = sec.scoped();
		return Promise.all([
			scoped.addRole('member'),
			scoped.addRole('leader'),
			scoped.addRole('admin')
		]).then(([member, leader, admin]) => {
			return sec.inheritRoleFrom(admin, member)
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id]);
				})
				.then(() => sec.inheritRoleFrom(admin, leader))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				})
				.then(() => sec.uninheritRoleFrom(admin, member))
				.then(role => {
					assert.sameMembers(role.parentIds, [leader.id]);
				})
				.then(() => sec.setRoleInherits(admin, [admin, member, leader]))
				.then(role => {
					assert.sameMembers(role.parentIds, [member.id, leader.id]);
				});
		});
	});

	it('should get roles parents', () => {
		return createInheritedRoles(sec.scoped()).then(([A, B, C, D, ABC, BCD]) => {
			return sec.getParentRoles([ABC, BCD]).then(parents => {
				assert.sameDeepMembers(parents.map(p => p.name), ['A', 'B', 'C', 'D']);
			});
		});
	});

	it('should recurse parents ', () => {
		return createInheritedRoles(sec.scoped()).then(([A, B, C, D, ABC, BCD, ABCD]) => {
			return sec.recurseParentRoleIds(ABCD).then(parentIds => {
				assert.sameDeepMembers(parentIds, [A, B, C, D, ABC, BCD].map(r => r.id));
			});
		});
	});

	it('should assign user roles', () => {
		const scoped = sec.scoped('123');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assignRolesUsers([A, B, C], 'Tom').then(mappings => {
				assert.lengthOf(mappings, 3);
				assert.sameDeepMembers(mappings.map(m => _.omit(m.toObject(), 'id')), [
					{roleId: A.id, scope: '123', userId: 'Tom'},
					{roleId: B.id, scope: '123', userId: 'Tom'},
					{roleId: C.id, scope: '123', userId: 'Tom'}
				]);
			});
		});
	});

	it('should unassign user roles', () => {
		const scoped = sec.scoped('123');
		return createInheritedRoles(scoped).then(([A, B, C]) => {
			return scoped.assignRolesUsers([A, B, C], 'Tom').then(() => {
				return scoped.unassignRolesUsers(A, 'Tom').then(info => {
					assert.deepEqual(info, {count: 1});
					return sec.models.SecRoleMapping.find().then(mappings => {
						assert.sameDeepMembers(mappings.map(m => _.omit(m.toObject(), 'id')), [
							{roleId: B.id, scope: '123', userId: 'Tom'},
							{roleId: C.id, scope: '123', userId: 'Tom'}
						]);
					});
				});
			});
		});
	});

	it('should find roles by users', () => {
		const X = sec.scoped('X');
		const Y = sec.scoped('Y');
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
					assert.sameDeepMembers(roles, [XA.id, XB.id]);
				});
			});
		});
	});

	it('should find roles recursively by users', () => {
		const X = sec.scoped('X');
		const Y = sec.scoped('Y');
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
					assert.sameDeepMembers(roles, [XA.id, XB.id, XC.id, XABC.id]);
				});
			});
		});
	});

	it('should find users by roles', () => {
		const X = sec.scoped('X');
		const Y = sec.scoped('Y');
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
			});
		});
	});

	it('should has roles with role id', () => {
		const X = sec.scoped('X');
		const Y = sec.scoped('Y');
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
		const X = sec.scoped('X');
		const Y = sec.scoped('Y');
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

function createInheritedRoles(sec) {
	if (!sec.isScoped) throw new Error('require scoped roles');
	return Promise.all([
		sec.addRole('A'),
		sec.addRole('B'),
		sec.addRole('C'),
		sec.addRole('D'),
		sec.addRole('ABC'),
		sec.addRole('BCD'),
		sec.addRole('ABCD')
	]).then(roles => {
		const [A, B, C, D, ABC, BCD, ABCD] = roles;
		return Promise.all([
			sec.inheritRoleFrom(ABC, [A, B, C]),
			sec.inheritRoleFrom(BCD, [B, C, D]),
			sec.inheritRoleFrom(ABCD, [ABC, BCD])
		]).thenReturn(roles);
	});
}
