'use strict';

const assert = require('assert');

const securers = {
	mongodb: require('./mongodb')
};

exports.find = exports.findSecure = function (name) {
	return securers[(name || '').toLowerCase()];
};

exports.get = exports.getSecure = function (name) {
	const secure = exports.find(name);
	assert(secure, 'Unsupported secure: ' + name);
	return secure;
};

