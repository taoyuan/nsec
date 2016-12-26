'use strict';

const debug = require('debug')('nsec:secure');
const _ = require('lodash');
const securers = require('./securers');

module.exports = function (acl, Model, opts) {
	const connector = Model.getDataSource().connector;
	const securer = securers.getSecurer(connector.name);

	if (_.isFunction(opts)) {
		opts = {getCurrentSubjects: opts};
	}
	opts = opts || {};

	// eslint-disable-next-line camelcase
	Model._nsec_secures = Model._nsec_secures || {};

	let secure = securer(acl, Model, opts);
	if (_.isFunction(secure)) {
		secure = {access: secure};
	}

	if (secure.access) {
		attachObserve('access', Model);
	}

	if (secure.execute) {
		attachObserve('execute', connector);
	}

	function attachObserve(operation, observer) {
		if (Model._nsec_secures[operation]) {
			Model.removeObserver(operation, Model._nsec_secures[operation]);
		}
		Model._nsec_secures[operation] = wrap(operation, secure[operation]);
		observer.observe(operation, Model._nsec_secures[operation]);
	}

	function wrap(operation, observe) {
		return (ctx, next) => {
			// const opts = Model.__nsec_secure__ || {};
			ctx.options = _.defaults(ctx.options || {}, {secure: opts.secure});

			debug('---');
			debug('Securing %s:%s', Model.modelName, operation);

			const {query, options} = ctx;
			if (options.secure === false || options.skipSecure) {
				debug('{secure: false} or {skipSecure: true} - skipping secure');
				return next();
			}

			if (operation === 'access') {
				// Do not secure if the request is being made against a single model instance.
				if (query && _.get(query, 'where.id')) {
					debug('looking up by Id - skipping secure');
					return next();
				}
			}

			if (observe.length >= 2) {
				observe(ctx, next);
			} else {
				observe(ctx);
				next();
			}
		};
	}
};
