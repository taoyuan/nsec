'use strict';

const assert = require('assert');
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
	if (_.isObject(target) && target.id) {
		if (target.constructor.modelName) {
			return target.constructor.modelName + separator + target.id;
		}
		return _.get(target, 'id');
	}
	if (target && target.toString() === '[object Object]') {
		throw new Error('Unsupported target to identify: ' + JSON.stringify(target));
	}
	return target.toString();
}

exports.typeid = typeid;
function typeid(entity) {
	assert(entity, '`entity` must not be null');
	let type = null;
	let id = null;
	if (_.isString(entity)) {
		type = entity;
	} else if (_.isObject(entity)) {
		if (entity.id && entity.constructor.modelName) {
			type = entity.constructor.modelName;
			id = entity.id;
		} else if (entity.type && entity.id) {
			type = entity.type;
			id = entity.id;
		}
	}

	if (!type) {
		throw new Error('Invalid entity: ' + JSON.stringify(entity));
	}

	return {type, id};
}
