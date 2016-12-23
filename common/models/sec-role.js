'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const shortid = require('shortid');
const arrify = require('arrify');

/* eslint-disable */
/**
 * @class Role
 */
function Role() {
	// this is a dummy placeholder for jsdox
}
/* eslint-enable */

module.exports = function (Role) {
	Role.definition.rawProperties.id.default =
		Role.definition.properties.id.default = function () {
			return shortid();
		};

	Role.prototype.resolveParentIds = function (parents) {
		return Role.resolve(parents, p => p.id !== this.id && p.scope === this.scope).map(p => p.id);
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
	 * @param {Function|String} [filter]
	 * @return {Promise.<[Role]>}
	 */
	Role.resolve = function (roles, filter) {
		let scope;
		if (_.isString(filter)) {
			scope = filter;
			filter = (role => role.scope === scope);
		}
		if (!_.isFunction(filter)) {
			filter = _.identity;
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
