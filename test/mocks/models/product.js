'use strict';

module.exports = function (ds) {
	ds.createModel('Product', {
		name: 'string'
	}, {
		relations: {
			store: {
				type: 'belongsTo',
				model: 'Store'
			}
		}
	});
};
