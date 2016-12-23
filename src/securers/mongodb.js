'use strict';

const assert = require('assert');
const _ = require('lodash');
const arrify = require('arrify');
const util = require('util');
const utils = require('../utils');

// TODO Should we deal with commands: update, remove ?
const COMMAND = ['find', 'findOne', 'findAndModify', 'count'];

module.exports = function (Model, opts) {
	const modelName = Model.modelName;
	const {dirty, property, getCurrentSubjects} = opts;

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

	return function (ctx) {
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
			return;
		}

		const subjects = arrify(getCurrentSubjects());
		if (_.isEmpty(subjects)) {
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
	};
};
