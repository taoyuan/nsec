'use strict';

const _ = require('lodash');
const secures = require('./secures');

module.exports = function (acl, Model, opts) {
	const connector = Model.getDataSource().connector;
	const secure = secures.getSecure(connector.name);

	if (Model.__nsec_secured__) return;

	// eslint-disable-next-line
	Model.__nsec_secured__ = true;

	if (_.isFunction(opts)) {
		opts = {getCurrentSubjects: opts};
	}
	opts = opts || {};

	secure(acl, Model, opts);
};
