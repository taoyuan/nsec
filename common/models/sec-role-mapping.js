"use strict";

const shortid = require('shortid');

module.exports = function (RoleMapping) {
	RoleMapping.definition.rawProperties.id.default =
		RoleMapping.definition.properties.id.default = function () {
			return shortid();
		};

	RoleMapping.validatesUniquenessOf('userId', {scopedTo: ['roleId']});

	return RoleMapping;
};
