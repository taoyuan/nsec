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
	const fixtures = needs(path.join(__dirname, './fixtures/models'));
	return PromiseA.all(_.map(fixtures, (data, model) => {
		if (ds.models[model]) {
			return PromiseA.fromCallback(cb => ds.models[model].create(data, cb));
		}
	}));
}

function cleanup(ds) {
	const models = _.values(ds.models).filter(m => m.destroyAll);
	// console.log('deleting all data for models %j', models.map(m => m.modelName));
	return PromiseA.map(models, model => model.destroyAll({}));
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
