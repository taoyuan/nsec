'use strict';

const assert = require('assert');

const securers = {
	mongodb: require('./mongodb')
};

function findSecurer(name) {
	return securers[(name || '').toLowerCase()];
}
exports.find = exports.findSecurer = findSecurer;

function getSecurer(name) {
	const secure = findSecurer(name);
	assert(secure, 'Unsupported secure: ' + name);
	return secure;
}
exports.get = exports.getSecurer = getSecurer;

