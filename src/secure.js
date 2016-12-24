'use strict';

const _ = require('lodash');
const PromiseA = require('bluebird');
const securers = require('./securers');

module.exports = function (acl, Model, opts) {
	const connector = Model.getDataSource().connector;
	const securer = securers.getSecurer(connector.name);
	if (!securer) {
		throw new Error('nsec model find secure only support mongodb currently. current connector is: ' + connector.name);
	}
	if (Model.__nsec_secured__) {
		return;
	}
	// eslint-disable-next-line
	Model.__nsec_secured__ = true;

	if (_.isFunction(opts)) {
		opts = {getCurrentSubjects: opts};
	}
	opts = opts || {};

	const secure = securer(acl, Model, opts);

	connector.observe('before execute', (ctx, next) => {
		if (secure.length > 1) {
			secure(ctx, next);
		} else {
			PromiseA.resolve(secure(ctx)).nodeify(next);
		}
	});
};
