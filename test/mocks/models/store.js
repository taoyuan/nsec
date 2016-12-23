'use strict';

module.exports = function (ds) {
	ds.createModel('Store', {
		name: 'string'
	}, {
		relations: {
			store: {
				type: 'hasMany',
				model: 'Product'
			}
		}
	});
};
