'use strict';

const debug = require('debug')('nsec:secure');
const _ = require('lodash');
const adapters = require('./secure-adapters');

function secure(acl, Model, opts) {
	const connector = Model.getDataSource().connector;
	const adapter = adapters.get(connector.name);
	const modelName = Model.modelName;

	debug('Securing model %s', modelName);

	if (_.isFunction(opts)) {
		opts = {getCurrentSubjects: opts};
	}
	opts = opts || {};

	const settings = Model._nsec = Model._nsec || {};
	// eslint-disable-next-line camelcase
	settings.secures = settings.secures || {};

	let secures = adapter(acl, Model, opts);
	if (_.isFunction(secures)) {
		secures = {access: secures};
	}

	if (secures.access) {
		attachObserve('access', Model);
	}

	if (secures.execute) {
		attachObserve('execute', connector);
	}

	acl.securedModels = acl.securedModels || {};
	acl.securedModels[modelName] = Model;

	// ------------------
	// Internal Functions
	// ------------------
	function attachObserve(operation, observer) {
		if (settings.secures[operation]) {
			observer.removeObserver(operation, settings.secures[operation]);
		}
		settings.secures[operation] = wrap(operation, secures[operation]);
		observer.observe(operation, settings.secures[operation]);
	}

	function wrap(operation, observe) {
		return (ctx, next) => {
			// const opts = Model.__nsec_secure__ || {};
			ctx.options = _.defaults(ctx.options || {}, {secure: opts.secure});

			debug('---');
			debug('Securing %s:%s', modelName, operation);

			const {query, options} = ctx;

			if (options.secure === false) {
				debug('{secure: false} or {rowlevel: false} - skipping secure');
				return next();
			}

			const forceSecure = options.secure === true;

			if (operation === 'access') {
				// Do not secure if the request is being made against a single model instance.
				if (!forceSecure && _.get(query, 'where.id')) {
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
}

function unsecure(acl, Model) {
	const modelName = Model.modelName;
	const connector = Model.getDataSource().connector;

	debug('Unsecuring model %s', modelName);

	const secures = _.get(Model, '_nsec.secures');
	if (!_.isEmpty(secures)) {
		_.forEach(secures, (listener, operation) => {
			if (operation === 'execute') {
				connector.removeObserver(operation, listener);
			} else {
				Model.removeObserver(operation, listener);
			}
		});
		delete Model._nsec;
	}

	delete acl.securedModels[modelName];
}

module.exports = {secure, unsecure};
