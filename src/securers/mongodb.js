'use strict';

const assert = require('assert');
const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');
const util = require('util');
const utils = require('../utils');

// TODO Should we deal with commands: update, remove ?
const COMMAND = ['find', 'findOne', 'findAndModify', 'count'];

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

	return function (ctx, next) {
		// ctx:
		// 	{
		//	 	model: model,
		// 	 	collection: collection,
		// 		req: {
		//			command: command,
		// 		 	params: args,
		// 	 	},
		// 	};
		let {req, options} = ctx;

		if (ctx.model !== modelName || !COMMAND.includes(req.command) || !property) {
			return next();
		}

		options = options || {};
		if (options.secure === false || options.skipSecure) {
			return next();
		}

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
				if (_.isEmpty(subjects) || subjects.includes(admin)) {
					return;
				}

				const cond = {
					$or: [
						{[property]: null},
						{[property]: {$size: 0}},
						{[property]: {$elemMatch: {subject: {$in: subjects}, actions: {$in: actions}}}}
					]
				};

				req.params[0] = _.isEmpty(req.params[0]) ? cond : {$and: [req.params[0], cond]};
			}).nodeify(next);
	};
};
