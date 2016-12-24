'use strict';

require('chai').use(require('chai-as-promised'));
const _ = require('lodash');
const path = require('path');
const needs = require('needs');
const PromiseA = require('bluebird');
const pkg = require('../package.json');

const DataSource = require('loopback-datasource-juggler').DataSource;
const ds = exports.ds = new DataSource('mongodb', {database: '__test__' + pkg.name, strictObjectIDCoercion: true});
require('./mocks/models/user')(ds);
require('./mocks/models/store')(ds);
require('./mocks/models/product')(ds);

function loadMockModelsFixtures(ds) {
	const datas = needs(path.join(__dirname, './fixtures/models'));
	return PromiseA.resolve(_.map(datas, (data, model) => {
		if (ds.models[model]) {
			return ds.models[model].create(data);
		}
	}));
}

function cleanup(ds) {
	return PromiseA.map(_.values(ds.models), model => model.dataSource && model.destroyAll());
}

exports.setup = function () {
	return cleanup(ds).then(() => loadMockModelsFixtures(ds));
};

exports.teardown = function () {
	return cleanup(ds);
};

exports.models = ds.models;

exports.User = ds.models.User;
exports.Product = ds.models.Product;
