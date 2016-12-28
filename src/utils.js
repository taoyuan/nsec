'use strict';

const _ = require('lodash');

exports.hideProperty = hideProperty;
function hideProperty(Model, property) {
	const settings = Model.definition && Model.definition.settings;

	settings.hidden = settings.hidden || [];
	settings.hidden.push(property);

	if (settings.hiddenProperties) {
		settings.hiddenProperties[property] = true;
	}
}

exports.identify = identify;
function identify(target, separator = ':') {
	const {type, id} = typeid(target);
	if (type && id) {
		return type + separator + id;
	} else if (type || id) {
		return type || id;
	}
	if (target && target.toString() === '[object Object]') {
		throw new Error('Unsupported target to identify: ' + JSON.stringify(target));
	}
	return target.toString();
}

exports.typeid = typeid;
function typeid(target) {
	let type = target;
	let id;
	if (_.isFunction(target)) {
		target = target.modelName;
	}
	if (_.isString(target)) {
		[type, id] = target.split(':');
	} else if (_.isObject(target)) {
		type = target.constructor.modelName || target.type;
		id = target.id;
	}

	if (id && _.isObject(id)) {
		id = id.toString();
	}

	return {type, id};
}
