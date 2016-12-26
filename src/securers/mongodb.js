'use strict';

const debug = require('debug')('nsec:secure:mongodb');
const assert = require('assert');
const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');
const utils = require('../utils');

module.exports = function (acl, model, opts) {
	const modelName = model.modelName;
	let {dirty, property, admin, actions, getCurrentSubjects} = opts;

	assert(dirty, 'MongoDB securer only support dirty mode');
	assert(property, '"property" is required');

	admin = admin || 'admin';

	actions = arrify(actions);
	if (_.isEmpty(actions)) {
		actions.push('read');
	}
	actions = actions.map(_.toUpper);

	if (!model.definition.properties[property]) {
		debug('Property "%" has been exist in Model "%s", user it and skip defining', property, modelName);

		// Define permissions property
		model.defineProperty(property, {type: [Object]});
		// Hide permissions property
		utils.hideProperty(model, property);
	}

	return {
		access: (ctx, next) => {
			let {query, options} = ctx;
			options = options || {};

			const userId = (options.accessToken && options.accessToken.userId) ||
				(options.userId) ||
				(options.user && options.user.id);

			debug(`Current user from options is: %s`, userId);

			PromiseA.resolve()
				.then(() => {
					if (_.isFunction(getCurrentSubjects)) {
						debug('Fetch current subjects from "getCurrentSubjects" function');
						return PromiseA.resolve(getCurrentSubjects());
					} else if (userId) {
						debug('Checking current user whether is admin');
						return acl.hasRoles(userId, admin).then(isAdmin => {
							// if is admin, return nothing to skip secure
							if (isAdmin) {
								debug('Current user is admin');
								return admin;
							}
							debug('Current user is not admin, find roles for current user');
							return acl.scoped('*').findUserRoles(userId, true).then(roles => [userId, ...roles]);
						});
					} else {
						debug('No subjects provided for getCurrentSubjects and options.accessToken');
					}
				})
				.then(subjects => {
					if (subjects === admin) {
						return debug('Current is admin, skip secure');
					}
					if (_.isEmpty(subjects)) {
						return debug('No subjects found, skip secure');
					}
					subjects = arrify(subjects).map(s => utils.identify(s));
					debug('Current subjects: %j', subjects);
					const cond = {
						or: [
							{[property]: null},
							{[property]: {size: 0}},
							{[property]: {elemMatch: {subject: {$in: subjects}, actions: {$in: actions}}}}
						]
					};
					query.where = _.isEmpty(query.where) ? cond : {and: [query.where, cond]};
					debug('Secured query where: %j', query.where);
				}).nodeify(next);
		}
	};
};
