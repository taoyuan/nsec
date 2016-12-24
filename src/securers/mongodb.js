'use strict';

const assert = require('assert');
const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');
const util = require('util');
const utils = require('../utils');

// TODO Should we deal with commands: update, remove ?
const COMMAND = ['find', 'findOne', 'findAndModify', 'count'];

module.exports = function (Model, opts) {
	const modelName = Model.modelName;
	let {dirty, property, admin, actions, getCurrentSubjects} = opts;

	assert(dirty, 'MongoDB securer only support dirty mode');
	assert(property, '"property" is required');

	admin = admin || '$admin';

	actions = arrify(actions);
	if (_.isEmpty(actions)) {
		actions.push('read');
	}
	actions = actions.map(_.toUpper);

	if (Model.definition.properties[property]) {
		throw new Error(util.format('Property "%" has been exist in Model "%s", specify another property for permissions',
			property, modelName));
	}

	// Define permissions property
	Model.defineProperty(property, {type: [Object]});

	// Hide permissions property
	utils.hideProperty(Model, property);

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
		const {req, options} = ctx;

		if (ctx.model !== modelName || !COMMAND.includes(req.command) || !property) {
			return next();
		}

		if (options && (options.secure === false || options.skipSecure)) {
			return next();
		}

		PromiseA.resolve(getCurrentSubjects()).then(subjects => {
			subjects = arrify(subjects).map(s => utils.identify(s));
			if (subjects.includes(admin)) {
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
