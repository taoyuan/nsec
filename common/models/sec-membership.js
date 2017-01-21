"use strict";

const timestampMixin = require('loopback-ds-timestamp-mixin/time-stamp');
const shortid = require('shortid');

module.exports = function (SecMembership) {
	timestampMixin(SecMembership);

	SecMembership.definition.rawProperties.id.default =
		SecMembership.definition.properties.id.default = function () {
			return shortid();
		};

	SecMembership.validatesUniquenessOf('userId', {scopedTo: ['roleId']});
	SecMembership.validatesUniquenessOf('userId', {scopedTo: ['scope', 'scopeId']});

	return SecMembership;
};
