"use strict";

const shortid = require('shortid');

module.exports = function (SecMembership) {
	SecMembership.definition.rawProperties.id.default =
		SecMembership.definition.properties.id.default = function () {
			return shortid();
		};

	SecMembership.validatesUniquenessOf('userId', {scopedTo: ['roleId']});

	return SecMembership;
};
