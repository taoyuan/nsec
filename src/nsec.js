'use strict';

const Acl = require('./acl');
const utils = require('./utils');

const nsec = module.exports = createAcl;

nsec.version = require('../package.json').version;

function createAcl(ds, options) {
	options = options || {};
	options.scope = options.scope || null;
	return new Acl(ds, options);
}

nsec.identify = function (target, separator) {
	return utils.identify(target, separator);
};
