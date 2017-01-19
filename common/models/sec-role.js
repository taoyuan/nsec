'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const shortid = require('shortid');
const arrify = require('arrify');
const timestampMixin = require('loopback-ds-timestamp-mixin/time-stamp');

const utils = require('../../src/utils');

/* eslint-disable */
/**
 * @class Role
 */
function Role() {
	// this is a dummy placeholder for jsdox
}
/* eslint-enable */

module.exports = function (Role) {
	timestampMixin(Role);
	Role.definition.rawProperties.id.default =
		Role.definition.properties.id.default = function () {
			return shortid();
		};

	Role.prototype.resolveParents = function (parents) {
		return Role.resolve(parents, _.pick(this, ['scope', 'scopeId'])).filter(p => p.id !== this.id);
	};

	Role.prototype.resolveParentIds = function (parents) {
		return this.resolveParents(parents).map(p => p.id);
	};

	/**
	 * Inherit from parents
	 *
	 * @param {Role|String} parents
	 * @return {Promise.<Role>}
	 */
	Role.prototype.inherit = function (parents) {
		return this.resolveParentIds(parents)
			.then(parentIds => this.parentIds = _.union(this.parentIds, parentIds))
			.then(() => this.save());
	};

	/**
	 * Uninherit form parents
	 *
	 * @param parents
	 * @return {Promise.<Role>}
	 */
	Role.prototype.uninherit = function (parents) {
		return this.resolveParentIds(parents)
			.then(parentIds => this.parentIds = _.without(this.parentIds, ...parentIds))
			.then(() => this.save());
	};

	/**
	 * Set parents to role's inherits
	 *
	 * @param parents
	 * @return {Promise.<Role>}
	 */
	Role.prototype.setInherits = function (parents) {
		return this.resolveParentIds(parents)
			.then(parents => this.parentIds = parents)
			.then(() => this.save());
	};

	/**
	 * Resolve roles with filter function or scope
	 *
	 * @param {[Object]|[String]|Object|String} roles
	 * @param {Function|String| Object} [filter]
	 * @return {Promise.<[Role]>}
	 */
	Role.resolve = function (roles, filter) {
		let scope;
		let scopeId;
		if (!_.isFunction(filter)) {
			if (_.isString(filter) || _.isNull(filter)) {
				const {type, id} = utils.typeid(filter);
				scope = type;
				scopeId = id;
			}
			if (_.isObject(filter)) {
				scope = filter.scope;
				scopeId = filter.scopeId;
				filter = role => (_.isUndefined(scope) || role.scope === scope) && (_.isUndefined(scopeId) || role.scopeId === scopeId);
			} else {
				filter = _.identity;
			}
		}

		const ids = [];
		roles = arrify(roles).filter(p => {
			if (!p) {
				return false;
			}
			if (typeof p === 'string') {
				ids.push(p);
				return false;
			}
			if (p.inherit && p.uninherit) {
				return filter(p);
			}
			console.warn('Invalid object:', p);
			return false;
		});

		const promise = Promise.resolve(_.isEmpty(ids) ? [] : Role.find({
				where: {
					scope,
					scopeId,
					or: [{
						id: {inq: ids}
					}, {
						name: {inq: ids}
					}]
				}
			}));
		return promise.then(found => _(roles).concat(found).uniqBy('id').filter(filter).value());
	};

	return Role;
};
