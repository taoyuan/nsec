'use strict';

const timestampMixin = require('loopback-ds-timestamp-mixin/time-stamp');

module.exports = function (SecEntity) {
	timestampMixin(SecEntity);
	return SecEntity;
};
