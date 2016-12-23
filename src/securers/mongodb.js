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
	let {admin, dirty, property, getCurrentSubjects} = opts;

	admin = admin || '$admin';

	assert(dirty, 'MongoDB securer only support dirty mode');
	assert(property, '"property" is required');

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
		const {req} = ctx;
		if (ctx.model !== modelName || !COMMAND.includes(req.command) || !property) {
			next();
			return;
		}

		PromiseA.resolve(getCurrentSubjects()).then(subjects => {
			subjects = arrify(subjects).map(utils.identify);
			if (subjects.includes(admin)) {
				return;
			}

			req.params[0] = {
				$and: [
					req.params[0],
					{
						$or: [
							{[property]: null},
							{[property]: {$size: 0}},
							{[property]: {$elemMatch: {subject: {$in: subjects}, actions: 'read'}}}
						]
					}]
			};
		}).nodeify(next);
	};
};
