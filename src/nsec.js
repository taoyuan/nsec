'use strict';

const Security = require('./security');

const nsec = module.exports = createSecurity;

nsec.version = require('../package.json').version;

function createSecurity(ds, options) {
	options = options || {};
	options.scope = options.scope || null;
	return new Security(ds, options);
}
