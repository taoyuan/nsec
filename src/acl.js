'use strict';

const _ = require('lodash');

const modeler = require('./modeler');
const permissible = require('./acl-permissible');
const Roles = require('./roles');
const secure = require('./secure');
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
		return secure(this, Model, options);
	}

	getCurrentUserId(options) {
		options = options || {};
		return _.get(options, 'accessToken.userId') || _.get(options, 'user.id') || options.userId;
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

	assignRolesUsers(roles, users) {
		return this.roles.assignRolesUsers(...arguments);
	}

	unassignRolesUsers(roles, users) {
		return this.roles.unassignRolesUsers(...arguments);
	}

	findUserRoleMappings(user) {
		return this.roles.findUserRoleMappings(...arguments);
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
