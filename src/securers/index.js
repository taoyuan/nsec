'use strict';

const securers = {
	mongodb: require('./mongodb')
};

exports.get = exports.getSecurer = function (name) {
	return securers[(name || '').toLowerCase()];
};

