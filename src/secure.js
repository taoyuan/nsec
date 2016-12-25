'use strict';

const _ = require('lodash');
const securers = require('./securers');

module.exports = function (acl, Model, opts) {
	const connector = Model.getDataSource().connector;
	const securer = securers.getSecurer(connector.name);

	if (_.isFunction(opts)) {
		opts = {getCurrentSubjects: opts};
	}
	opts = opts || {};

	const secured = Boolean(Model.__nsec_secure__);
	// eslint-disable-next-line camelcase
	Model.__nsec_secure__ = opts || {};

	if (secured) {
		return;
	}

	let secure = securer(acl, Model, opts);
	if (_.isFunction(secure)) {
		secure = {access: secure};
	}

	if (secure.access) {
		Model.observe('access', wrap(secure.access));
	}

	if (secure.execute) {
		connector.observe('execute', wrap(secure.execute));
	}

	function wrap(observe) {
		return (ctx, next) => {
			const opts = Model.__nsec_secure__ || {};
			ctx.options = _.defaults(ctx.options || {}, {secure: opts.secure});
			if (observe.length >= 2) {
				observe(ctx, next);
			} else {
				observe(ctx);
				next();
			}
		};
	}
};
