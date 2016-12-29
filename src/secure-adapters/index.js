'use strict';

const assert = require('assert');

const adapters = {
	mongodb: require('./mongodb')
};

function find(name) {
	return adapters[(name || '').toLowerCase()];
}
exports.find = find;

function get(name) {
	const secure = find(name);
	assert(secure, 'Unsupported secure: ' + name);
	return secure;
}
exports.get = get;

