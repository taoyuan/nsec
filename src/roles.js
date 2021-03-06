'use strict';

const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');

const schema = require('./schema');

class Roles {

	constructor(acl) {
		this.acl = acl;
	}

	_withScope(data) {
		const {scope, scopeId} = this.acl;
		return Object.assign({scope, scopeId}, data);
	}

	//----------------------------------------------
	// Basic CRUD
	//----------------------------------------------

	/**
	 * Find roles with filter
	 *
	 * @param {Object} [filter]
	 * @param {Object} [options]
	 * @return {*}
	 */
	findRoles(filter, options) {
		schema.apply('filter', filter);

		const {SecRole} = this.acl.models;

		if (this.acl.isScoped) {
			filter = filter || {};
			filter.where = this._withScope(filter.where);
		}

		return SecRole.find(filter, options);
	}

	/**
	 * Count for roles
	 *
	 * @param {Object} [where] where object
	 * @param {Object} [options]
	 */
	countRoles(where, options) {
		where = where || {};
		schema.apply('where', where);

		const {SecRole} = this.acl.models;

		if (this.acl.isScoped) {
			where = this._withScope(where);
		}
		return SecRole.count(where, options);
	}

	/**
	 * Remove roles by where object or name|id for scoped mode
	 *
	 * @param {Object|String} [where] where object or name|id for scoped remove
	 * @param {Object} [options]
	 * @return {*}
	 */
	removeRoles(where, options) {
		where = where || {};
		if (this.acl.isScoped) {
			schema.apply('argStrObj', where);
			if (_.isString(where)) {
				where = {or: [{name: where}, {id: where}]};
			}
			where = this._withScope(where);
		} else {
			schema.apply('where', where);
		}

		const {SecRole, SecMembership} = this.acl.models;
		return SecRole.find({where, fields: ['id']}).then(ids => {
			if (_.isEmpty(ids)) {
				return {count: 0};
			}
			// TODO transaction ?
			return PromiseA.resolve()
			// Remove all related mappings
				.then(() => SecMembership.destroyAll({roleId: {inq: ids}}))
				.then(() => SecRole.destroyAll(where, options));
		});
	}

	/**
	 * Add role
	 *
	 * @param {Object|String} data SecRole data object or name for scoped mode
	 * @return {*}
	 */
	addRole(data) {
		if (this.acl.isScoped) {
			schema.apply('argStrObj', data);
			if (_.isString(data)) {
				data = {name: data};
			}
			data = this._withScope(data); // Object.assign({scope: this.acl.scope}, data);
		}

		schema.apply('roleData', data);

		const {SecRole} = this.acl.models;
		return PromiseA.fromCallback(cb => SecRole.findOrCreate({where: data}, data, cb));
	}

	//----------------------------------------------
	// Inherits and Parents
	//----------------------------------------------

	/**
	 * Inherit role from parent roles
	 *
	 * @param {SecRole|String} role
	 * @param {[String]} parents
	 * @return {Promise.<SecRole>}
	 */
	inheritRoleFrom(role, parents) {
		schema.apply('argRole', role);
		schema.apply('argRoles', parents);

		const {SecRole} = this.acl.models;
		const promise = _.isString(role) ? SecRole.findById(role) : PromiseA.resolve(role);
		return promise.then(role => role.inherit(parents));
	}

	/**
	 * Uninherit role's parents
	 *
	 * @param {SecRole|String} role
	 * @param {[String]} parents
	 * @return {Promise.<SecRole>}
	 */
	uninheritRoleFrom(role, parents) {
		schema.apply('argRole', role);
		schema.apply('argRoles', parents);

		const {SecRole} = this.acl.models;
		const promise = _.isString(role) ? SecRole.findById(role) : PromiseA.resolve(role);
		return promise.then(role => role.uninherit(parents));
	}

	/**
	 * Set parents to role's inherits
	 *
	 * @param {SecRole|String} role
	 * @param {[String]} parents
	 * @return {Promise.<SecRole>}
	 */
	setRoleInherits(role, parents) {
		schema.apply('argRole', role);
		schema.apply('argRoles', parents);

		const {SecRole} = this.acl.models;
		const promise = _.isString(role) ? SecRole.findById(role) : PromiseA.resolve(role);
		return promise.then(role => role.setInherits(parents));
	}

	/**
	 * Resolve roles or role ids to role instances
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {Promise.<[SecRole]>}
	 */
	resolveRoles(roles) {
		const {SecRole} = this.acl.models;
		return SecRole.resolve(roles, this._withScope());
	}

	/**
	 * Get first level parent role ids for roles specified
	 *
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {Promise.<[String]>}
	 */
	getParentRoleIds(roles) {
		return this.resolveRoles(roles).map(role => role.parentIds).then(_.flatten).then(_.uniq);
	}

	/**
	 * Get first level parent role objects for the roles specified
	 *
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {Promise.<[SecRole]>}
	 */
	getParentRoles(roles) {
		return this.getParentRoleIds(roles).then(ids => this.resolveRoles(ids));
	}

	/**
	 * Recurse get all parent role ids for the roles specified
	 *
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {Promise.<[String]>}
	 */
	recurseParentRoleIds(roles) {
		return this.recurseParentRoles(roles).map(r => r.id);
	}

	recurseParentRoles(roles) {
		const recurse = (roles, answer = {}) => {
			return this.getParentRoles(roles)
			// exclude resolved role to avoid cycle parent reference
				.then(parents => _.filter(parents, p => p && !answer[p.id]))
				.then(parents => {
					if (_.isEmpty(parents)) {
						return answer;
					}
					_.forEach(parents, p => answer[p.id] = p);
					return recurse(parents, answer);
				});
		};

		return recurse(roles).then(_.values);
	}

	//----------------------------------------------
	// Memberships
	//----------------------------------------------
	normalizeMembershipState(state) {
		if (!['pending', 'active'].includes(state)) {
			state = undefined;
		}
		return state;
	}

	assignMembership(user, role, state) {
		return this.assignMemberships(user, role, state).then(memberships => memberships[0]);
	}

	/**
	 * Assign roles to users
	 *
	 * @param {String|[String]} users
	 * @param {SecRole|String} role
	 * @param {String} [state] state `pending` or `active`
	 * @return {Promise.<[SecMembership]>}
	 */
	assignMemberships(users, role, state) {
		const roles = this.resolveRoles(role);
		users = arrify(users).map(u => unwrap(u)).filter(_.identity);

		const {SecMembership} = this.acl.models;

		// resolve and filter roles according scope
		// noinspection JSValidateTypes
		return PromiseA.all([roles, users]).then(([roles, users]) => {
			if (_.isEmpty(roles) || _.isEmpty(users)) return PromiseA.resolve([]);

			role = roles[0];

			const items = _.map(users, userId => ({
				userId,
				roleId: role.id,
				scope: role.scope,
				scopeId: role.scopeId,
				state
			}));

			if (_.isEmpty(items)) {
				return PromiseA.resolve([]);
			}

			return PromiseA.mapSeries(items, data => {
				const where = _.pick(data, ['userId', 'scope', 'scopeId']);
				return SecMembership.findOrCreate({where}, data).then(([inst, created]) => {
					return created ? inst : inst.updateAttributes(data);
				});
			});
		});
	}

	/**
	 * Unassign roles with users
	 *
	 * @param {String|[String]} users
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {*}
	 */
	unassignMemberships(users, roles) {
		// resolve and filter roles according scope
		if (users !== '*') {
			users = arrify(users).map(u => unwrap(u)).filter(_.identity);
		}
		if (roles !== '*') {
			roles = arrify(roles).map(r => unwrap(r)).filter(_.identity);
		}

		const {SecMembership} = this.acl.models;

		// noinspection JSValidateTypes
		const where = this._withScope();
		if (roles !== '*' && !_.isEmpty(users)) {
			where.roleId = {inq: roles};
		}
		if (users !== '*' && !_.isEmpty(users)) {
			where.userId = {inq: users};
		}

		return PromiseA.fromCallback(cb => SecMembership.destroyAll(where, cb));
	}

	updateMembership(where, {role, state}) {
		where = where || {};
		if (_.isString(where)) {
			where = {user: where};
		}
		return this.updateMemberships(where, {role, state}).then(memberships => memberships[0]);
	}

	updateMemberships(where, {role, state}) {
		where = where || {};
		if (_.isString(where) || Array.isArray(where)) {
			where = {users: where};
		}

		const data = {state: this.normalizeMembershipState(state)};
		if (role) {
			data.roleId = unwrap(role);
		}
		return this.findMemberships(where).map(m => m && m.updateAttributes(data));
	}

	findMemberships(where, filter) {
		where = where || {};
		if (Array.isArray(where) || _.isString(where)) {
			where = {users: where};
		}
		let {users, user, userId, roles, role, roleId, state} = where;
		users = users || user || userId;
		roles = roles || role || roleId;
		if (users && users !== '*') {
			users = arrify(users).map(u => unwrap(u)).filter(_.identity);
		}
		if (roles && roles !== '*') {
			roles = arrify(roles).map(r => unwrap(r)).filter(_.identity);
		}
		state = this.normalizeMembershipState(state);

		where = {state};
		if (!_.isEmpty(roles)) {
			where.roleId = {inq: roles};
		}
		if (!_.isEmpty(users)) {
			where.userId = {inq: users};
		}

		where = this._withScope(where);

		const {SecMembership} = this.acl.models;
		filter = filter || {};
		filter.where = filter.where ? {and: [filter.where, where]} : where;
		return PromiseA.fromCallback(cb => SecMembership.find(filter, cb));
	}

	findMembership(where, filter) {
		where = where || {};
		let userId, roleId;
		if (_.isString(where)) {
			userId = where;
		} else if (_.isObject(where)) {
			userId = where.userId || unwrap(where.user);
			roleId = where.roleId || unwrap(where.role);
		} else {
			throw new Error('`where` must be a string or an object contains `user` or `userId` prop at least');
		}
		const {SecMembership} = this.acl.models;
		where = this._withScope({userId, roleId});
		filter = filter || {};
		filter.where = filter.where ? {and: [filter.where, where]} : where;
		return PromiseA.fromCallback(cb => SecMembership.findOne(filter, cb));
	}

	/**
	 * Find user roles with user id
	 *
	 * @param {String|[String]} user User id
	 * @param {Boolean} [recursively]
	 * @return {Promise.<[String]>}
	 */
	findUserRoles(user, recursively) {
		const promise = this.findMemberships({user, state: 'active'})
			.map(m => m.roleId)
			.then(roleIds => this.resolveRoles(roleIds));

		if (recursively) {
			// noinspection JSValidateTypes
			return promise.then(roles => this.recurseParentRoles(roles)
				.then(parents => _.concat(roles, parents)))
				.then(roles => _.uniqBy(roles, 'id'));
		}
		// noinspection JSValidateTypes
		return promise;
	}

	/**
	 * Find role users with role id
	 *
	 * @param {SecRole|String|[SecRole]|[String]} role
	 * @return {Promise}
	 */
	findRoleUsers(role) {
		const {SecMembership} = this.acl.models;

		let promise = PromiseA.resolve();
		if (role && role !== '*' && role !== 'all') {
			promise = promise.then(() => {
				return this.resolveRoles(role).map(role => role.id).then(roles => {
					return {roleId: {inq: roles}};
				});
			});
		}

		return promise.then(where => {
			where = this._withScope(where);
			return PromiseA.fromCallback(cb => SecMembership.find({where}, cb)).map(m => m.userId).then(_.uniq);
		});
	}

	/**
	 *
	 * @param {String} user
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {Promise.<Boolean>}
	 */
	hasRoles(user, roles) {
		user = unwrap(user);
		const {SecMembership} = this.acl.models;
		return this.resolveRoles(roles).map(role => role.id).then(roles => {
			if (!user || _.isEmpty(roles)) {
				return PromiseA.resolve(false);
			}
			return SecMembership.count(this._withScope({
				userId: user,
				roleId: {inq: roles}
			})).then(c => c === roles.length);
		});
	}
}

module.exports = Roles;

// Internal Functions
function unwrap(target, prop) {
	prop = prop || 'id';
	return target && (_.isString(target) ? target : target[prop]);
}
