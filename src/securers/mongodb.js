'use strict';

const debug = require('debug')('nsec:secure:mongodb');
const assert = require('assert');
const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');
const util = require('util');
const utils = require('../utils');

module.exports = function (acl, model, opts) {
	const modelName = model.modelName;
	let {dirty, property, admin, actions, getCurrentSubjects} = opts;

	assert(dirty, 'MongoDB securer only support dirty mode');
	assert(property, '"property" is required');

	admin = admin || '$admin';

	actions = arrify(actions);
	if (_.isEmpty(actions)) {
		actions.push('read');
	}
	actions = actions.map(_.toUpper);

	if (model.definition.properties[property]) {
		throw new Error(util.format('Property "%" has been exist in Model "%s", specify another property for permissions',
			property, modelName));
	}

	// Define permissions property
	model.defineProperty(property, {type: [Object]});

	// Hide permissions property
	utils.hideProperty(model, property);

	return {
		access: (ctx, next) => {
			let {query, options} = ctx;
			options = options || {};

			const userId = options.accessToken && options.accessToken.userId;

			PromiseA.resolve()
				.then(() => {
					if (_.isFunction(getCurrentSubjects)) {
						return getCurrentSubjects();
					} else if (userId) {
						return acl.scoped('*').findUserRoles(userId, true).then(roles => [userId, ...roles]);
					}
				})
				.then(subjects => {
					subjects = arrify(subjects).map(s => utils.identify(s));
					if (!_.isEmpty(subjects) && !subjects.includes(admin)) {
						const cond = {
							or: [
								{[property]: null},
								{[property]: {size: 0}},
								{[property]: {elemMatch: {subject: {$in: subjects}, actions: {$in: actions}}}}
							]
						};
						query.where = _.isEmpty(query.where) ? cond : {and: [query.where, cond]};
					}
				}).nodeify(next);
		}
	};
};
