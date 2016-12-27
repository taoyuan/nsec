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

	const nsecSettings = Model._nsec = Model._nsec || {};
	// eslint-disable-next-line camelcase
	nsecSettings.secures = nsecSettings.secures || {};

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

	acl.securedModels = acl.securedModels || {};
	acl.securedModels[Model.modelName] = Model;

	// ------------------
	// Internal Functions
	// ------------------
	function attachObserve(operation, observer) {
		if (nsecSettings.secures[operation]) {
			Model.removeObserver(operation, nsecSettings.secures[operation]);
		}
		nsecSettings.secures[operation] = wrap(operation, secure[operation]);
		observer.observe(operation, nsecSettings.secures[operation]);
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
