'use strict';

const _ = require('lodash');

const modeler = require('./modeler');
const permissible = require('./acl-permissible');
const Roles = require('./roles');
const securer = require('./securer');
const utils = require('./utils');

const DEFAULT_PERMISSIONS_PROPERTY = '_permissions';

class Acl {

	/**
	 * Security constructor
	 *
	 * @param {String|Object} [ds]
	 * @param {Object} [opts]
	 * @param {String} [opts.scope]
	 * @param {String} [opts.scopeId]
	 * @param {Boolean} [opts.dirty] is dirty mode. Default is true.
	 * @param {String} [opts.property] property name for dirty mode. Default is "_permission".
	 * @param {Function} [opts.findCorrelatedSubjects] find correlated roles for the subject (user or role).
	 * @param {Function} [opts.getCurrentSubjects] get current user and roles correlated.
	 * @param {Object|String} [opts.dataSource]
	 * @param {Object|String} [opts.datasource]
	 * @param {Object|String} [opts.ds]
	 * @param {Object} [opts.models]
	 * @param {Function} [opts.currentUser]
	 *
	 */
	constructor(ds, opts) {
		if (ds && !_.isString(ds) && !_.isFunction(_.get(ds, 'createModel'))) {
			opts = ds;
			ds = undefined;
		}
		opts = _.defaults({ds}, opts);
		opts.dirty = opts.dirty !== false;
		opts.property = opts.property || DEFAULT_PERMISSIONS_PROPERTY;

		this._opts = opts;
		this._scope = opts.scope;
		this._scopeId = opts.scopeId;
		this._models = opts.models ? opts.models : modeler.load(opts);
		this._currentUser = opts.currentUser || _.noop;

		this.roles = new Roles(this);
		permissible(this, opts);
	}

	get models() {
		return this._models;
	}

	get isScoped() {
		return !_.isUndefined(this._scope);
	}

	get scope() {
		return this._scope;
	}

	get scopeId() {
		return this._scopeId;
	}

	/**
	 *
	 * @param {String|Object|undefined} [scope]
	 * @param {String|undefined} [scopeId]
	 * @return {Acl}
	 */
	scoped(scope, scopeId) {
		if (scope === '*') {
			scope = undefined;
			scopeId = undefined;
		} else if (arguments.length <= 1) {
			const {type, id} = utils.typeid(scope);
			scope = type || null;
			scopeId = id;
		}

		return new Acl(Object.assign({}, this._opts, {models: this._models, scope, scopeId}));
	}

	/**
	 * Secure a model class for find
	 *
	 * @param {Function} Model model class to secure
	 * @param options
	 */
	secure(Model, options) {
		options = _.defaults(options || {}, this._opts);
		return securer.secure(this, Model, options);
	}

	unsecure(Model) {
		return securer.unsecure(this, Model);
	}

	getCurrentUserId(options) {
		options = options || {};
		const user = this._currentUser(options);
		if (_.isString(user)) {
			return user;
		} else if (_.isString(_.get(user, 'id'))) {
			return user.id;
		} else {
			return _.get(options, 'accessToken.userId') || options.userId || _.get(options, 'user.id') || options.user;
		}
	}

	// ------------------------
	// Roles function delegates
	// ------------------------
	/* eslint-disable */

	findRoles(filter, options) {
		return this.roles.findRoles(...arguments);
	}

	countRoles(where, options) {
		return this.roles.countRoles(...arguments);
	}

	removeRoles(where, options) {
		return this.roles.removeRoles(...arguments);
	}

	addRole(data) {
		return this.roles.addRole(...arguments);
	}

	inheritRoleFrom(role, parents) {
		return this.roles.inheritRoleFrom(...arguments);
	}

	uninheritRoleFrom(role, parents) {
		return this.roles.uninheritRoleFrom(...arguments);
	}

	setRoleInherits(role, parents) {
		return this.roles.setRoleInherits(...arguments);
	}

	resolveRoles(roles) {
		return this.roles.resolveRoles(...arguments);
	}

	getParentRoleIds(roles) {
		return this.roles.getParentRoleIds(...arguments);
	}

	getParentRoles(roles) {
		return this.roles.getParentRoles(...arguments);
	}

	recurseParentRoleIds(roles) {
		return this.roles.recurseParentRoleIds(...arguments);
	}

	assignMembership(user, role, state) {
		return this.roles.assignMembership(...arguments);
	}

	assignMemberships(users, roles, state) {
		return this.roles.assignMemberships(...arguments);
	}

	unassignMemberships(users, roles) {
		return this.roles.unassignMemberships(...arguments);
	}

	updateMembership(where, data) {
		return this.roles.updateMembership(...arguments);
	}

	updateMemberships(where, data) {
		return this.roles.updateMemberships(...arguments);
	}

	findMembership(where, filter) {
		return this.roles.findMembership(...arguments);
	}

	findMemberships(where, filter) {
		return this.roles.findMemberships(...arguments);
	}

	findUserRoles(user, recursively) {
		return this.roles.findUserRoles(...arguments);
	}

	findRoleUsers(role) {
		return this.roles.findRoleUsers(...arguments);
	}

	hasRoles(user, roles) {
		return this.roles.hasRoles(...arguments);
	}

	/* eslint-enable */
}

module.exports = Acl;
