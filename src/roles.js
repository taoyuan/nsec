'use strict';

const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');

const schema = require('./schema');

class Roles {

	constructor(sec) {
		this.sec = sec;
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

		const {SecRole} = this.sec.models;

		if (this.sec.isScoped) {
			const where = {scope: this.sec.scope};
			filter = filter || {};
			filter.where = filter.where ? {and: [filter.where, where]} : where;
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
		schema.apply('where', where);

		const {SecRole} = this.sec.models;

		if (this.sec.isScoped) {
			where = Object.assign({}, where, {scope: this.sec.scope});
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
		if (this.sec.isScoped) {
			schema.apply('argStrObj', where);
			if (_.isString(where)) {
				where = {or: [{name: where}, {id: where}]};
			}
			where = Object.assign({scope: this.sec.scope}, where);
		} else {
			schema.apply('where', where);
		}

		const {SecRole, SecRoleMapping} = this.sec.models;
		return SecRole.find({where, fields: ['id']}).then(ids => {
			if (_.isEmpty(ids)) {
				return {count: 0};
			}
			// TODO transaction ?
			return PromiseA.resolve()
			// Remove all related mappings
				.then(() => SecRoleMapping.destroyAll({roleId: {inq: ids}}))
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
		if (this.sec.isScoped) {
			schema.apply('argStrObj', data);
			if (_.isString(data)) {
				data = {name: data};
			}
			data = Object.assign({scope: this.sec.scope}, data);
		}

		schema.apply('roleData', data);

		const {SecRole} = this.sec.models;
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

		const {SecRole} = this.sec.models;
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

		const {SecRole} = this.sec.models;
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

		const {SecRole} = this.sec.models;
		const promise = _.isString(role) ? SecRole.findById(role) : PromiseA.resolve(role);
		return promise.then(role => role.setInherits(parents));
	}

	/**
	 * Resolve roles or role ids to role instances
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {Promise.<[SecRole]>}
	 */
	resolveRoles(roles) {
		const {SecRole} = this.sec.models;
		return SecRole.resolve(roles, this.sec.scope);
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
		const recurse = (roles, answer = []) => {
			return this.getParentRoleIds(roles)
			// exclude resolved role to avoid cycle parent reference
				.then(parentIds => _.filter(parentIds, id => !answer.includes(id)))
				.then(parentIds => {
					if (_.isEmpty(parentIds)) {
						return answer;
					}
					answer.push(...parentIds);
					return recurse(parentIds, answer);
				});
		};

		return recurse(roles);
	}

	//----------------------------------------------
	// SecRole Mappings
	//----------------------------------------------

	/**
	 * Assign roles to users
	 *
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @param {String|[String]} users
	 * @return {Promise.<[SecRoleMapping]>}
	 */
	assignRolesUsers(roles, users) {
		const proles = this.resolveRoles(roles);
		users = arrify(users).map(u => normalize(u)).filter(_.identity);

		const {SecRoleMapping} = this.sec.models;

		// resolve and filter roles according scope
		// noinspection JSValidateTypes
		return PromiseA.all([proles, users]).then(([roles, users]) => {
			if (_.isEmpty(roles) || _.isEmpty(users)) return PromiseA.resolve([]);

			const items = _.flatten(_.map(roles, role => _.map(users, userId => ({
				userId,
				roleId: role.id,
				scope: role.scope
			}))));

			if (_.isEmpty(items)) {
				return PromiseA.resolve([]);
			}

			return PromiseA.fromCallback(cb => SecRoleMapping.create(items, cb));
		});
	}

	/**
	 * Unassign roles with users
	 *
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @param {String|[String]} users
	 * @return {{count: Number}}
	 */
	unassignRolesUsers(roles, users) {
		// resolve and filter roles according scope
		if (roles !== '*') {
			roles = this.resolveRoles(roles).map(role => role.id);
		}
		if (users !== '*') {
			users = arrify(users).map(u => normalize(u)).filter(_.identity);
		}

		const {SecRoleMapping} = this.sec.models;

		// noinspection JSValidateTypes
		return PromiseA.all([roles, users]).then(([roles, users]) => {
			const where = {scope: this.sec.scope};
			if (roles !== '*' && !_.isEmpty(users)) {
				where.roleId = {inq: roles};
			}
			if (users !== '*' && !_.isEmpty(users)) {
				where.userId = {inq: users};
			}

			return PromiseA.fromCallback(cb => SecRoleMapping.destroyAll(where, cb));
		});
	}

	/**
	 * Find user roles with user id
	 *
	 * @param {String|[String]} user User id
	 * @param {Boolean} [recursively]
	 * @return {Promise.<[String]>}
	 */
	findUserRoles(user, recursively) {
		user = arrify(user).map(u => normalize(u)).filter(_.identity);
		const {SecRoleMapping} = this.sec.models;
		const where = {scope: this.sec.scope, userId: {inq: user}};
		const promise = PromiseA.fromCallback(cb => SecRoleMapping.find({where}, cb))
			.map(m => m.roleId).then(_.uniq);
		if (recursively) {
			// noinspection JSValidateTypes
			return promise.then(roleIds => this.recurseParentRoleIds(roleIds).then(parentIds => _.union(roleIds, parentIds)));
		}
		// noinspection JSValidateTypes
		return promise;
	}

	/**
	 * Find role users with role id
	 *
	 * @param {SecRole|String|[SecRole]|[String]} role
	 * @return {Promise.<[String]>}
	 */
	findRoleUsers(role) {
		const {SecRoleMapping} = this.sec.models;
		return this.resolveRoles(role).map(role => role.id).then(roles => {
			const where = {scope: this.sec.scope, roleId: {inq: roles}};
			return PromiseA.fromCallback(cb => SecRoleMapping.find({where}, cb))
				.map(m => m.userId).then(_.uniq);
		});
	}

	/**
	 *
	 * @param {String} user
	 * @param {SecRole|String|[SecRole]|[String]} roles
	 * @return {Promise.<Boolean>}
	 */
	hasRoles(user, roles) {
		user = normalize(user);
		const {SecRoleMapping} = this.sec.models;
		return this.resolveRoles(roles).map(role => role.id).then(roles => {
			if (!user || _.isEmpty(roles)) {
				return PromiseA.resolve(false);
			}
			return SecRoleMapping.count({
				scope: this.sec.scope,
				userId: user,
				roleId: {inq: roles}
			}).then(c => c === roles.length);
		});
	}
}

module.exports = Roles;

// Internal Functions
function normalize(target, prop) {
	prop = prop || 'id';
	target = target || '';
	return _.isString(target) ? target : target[prop];
}
