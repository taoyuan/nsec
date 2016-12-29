'use strict';

module.exports = function (ds) {
	ds.createModel('Store', {
		id: {
			type: 'string',
			id: true,
			generated: false,
			defaultFn: 'uuid'
		},
	}, {
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
