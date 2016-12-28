'use strict';

// Load modules
const joi = require('joi');
const Hoek = require('hoek');

// Declare internals
const internals = {};

exports.apply = function (type, options, message) {
	const result = joi.validate(options, internals[type]);
	Hoek.assert(!result.error, 'Invalid', type, 'options', message ? '(' + message + ')' : '', result.error && result.error.annotate());
	return options;	// result.value;
};

internals.strobj = [joi.object(), joi.string()];
internals.objs = [joi.object(), joi.array().items(joi.object())];

internals.model = joi.func();
internals.models = joi.alternatives([
	internals.model,
	joi.array().items(internals.model)
]);

internals.entity = joi.object({
	save: joi.func().optional()
}).unknown();

internals.entities = joi.alternatives([
	internals.entity,
	joi.string(),
	internals.model,
	joi.array().items(internals.entity, joi.string(), internals.model)
]);

internals.subject = joi.alternatives(internals.strobj);

internals.subjects = joi.alternatives([
	...internals.strobj,
	joi.array().items(...internals.strobj)
]);

internals.action = joi.string();

internals.actions = joi.alternatives([
	internals.action,
	joi.array().items(internals.action)
]);

internals.where = joi.object().allow(null);

// https://loopback.io/doc/en/lb2/Querying-data.html
internals.filter = joi.object({
	fields: joi.alternatives([...internals.strobj, joi.array().items(...internals.strobj)]),
	include: joi.alternatives([...internals.strobj, joi.array().items(...internals.strobj)]),
	limit: joi.number().optional(),
	skip: joi.number().optional(),
	order: joi.string().optional(),
	where: joi.object().optional()
}).unknown();

internals.roleData = joi.object({
	scope: joi.string().allow(null).required(),
	name: joi.string().required()
}).unknown();

internals.argStrObj = joi.alternatives(internals.strobj).allow(null);
internals.argRole = joi.alternatives(internals.strobj);
internals.argRoles = joi.alternatives([...internals.strobj, joi.array().items(...internals.strobj)]);

internals.argObjs = joi.alternatives(internals.objs);
