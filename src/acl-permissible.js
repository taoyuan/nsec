const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');
const schema = require('./schema');
const utils = require('./utils');

module.exports = function (acl, opts) {
	const {SecEntity} = acl.models;
	let {dirty, property, findCorrelatedSubjects} = opts;
	findCorrelatedSubjects = findCorrelatedSubjects || _.noop;

	acl.allow = function (subjects, entities, actions) {
		subjects = schema.apply('subjects', subjects);
		entities = schema.apply('entities', entities);
		actions = schema.apply('actions', actions);

		const multiple = Array.isArray(entities);
		subjects = _.uniq(arrify(subjects)).map(item => utils.identify(item)).filter(_.identity);
		entities = _.uniq(arrify(entities));
		actions = _.uniq(arrify(actions)).map(_.toUpper);

		if (_.isEmpty(subjects) ||
			_.isEmpty(entities) ||
			_.isEmpty(actions)) {
			return PromiseA.resolve();
		}

		return PromiseA.map(entities, entity => {
			if (!entity) return;
			if (!dirty || _.isString(entity) || _.isFunction(entity)) {
				let {type: entityType, id: entityId} = utils.typeid(entity);
				entityId = entityId || null;
				const data = {entityType, entityId};
				return SecEntity.findOrCreate({where: data}, data).then(([inst]) => allow(inst, 'permissions'));
			}
			return allow(entity, property);
		}).then(items => multiple ? items : items[0]);

		function allow(target, key) {
			// target[key] may be a loopback List, can not cloneDeep directly
			const permissions = _.map(target[key], _.cloneDeep);
			_.forEach(subjects, subject => {
				if (!subject) return;
				let permission = _.find(permissions, p => p.subject === subject);
				if (!permission) {
					permission = {subject};
					permissions.push(permission);
				}
				permission.actions = _.union(permission.actions || [], actions);
			});
			// target[key] = permissions;
			return update(target, key, permissions);
		}
	};

	acl.disallow = function (subjects, entities, actions) {
		schema.apply('subjects', subjects);
		schema.apply('entities', entities);

		if (_.isNil(actions) || (_.isString(actions) && ['*', 'ALL'].includes(_.toUpper(actions)))) {
			actions = '*';
		} else {
			schema.apply('actions', actions);
			actions = _.uniq(arrify(actions)).map(_.toUpper);
		}

		const multiple = Array.isArray(entities);
		subjects = _.uniq(arrify(subjects)).map(item => utils.identify(item)).filter(_.identity);
		entities = _.uniq(arrify(entities));

		if (_.isEmpty(subjects) ||
			_.isEmpty(entities) ||
			_.isEmpty(actions)) {
			return PromiseA.resolve();
		}

		return PromiseA.map(entities, entity => {
			if (!entity) return;
			if (!dirty || _.isString(entity) || _.isFunction(entity)) {
				let {type: entityType, id: entityId} = utils.typeid(entity);
				entityId = entityId || null;
				const data = {entityType, entityId};
				return SecEntity.findOne({where: data}).then(inst => {
					if (inst) return disallow(inst, 'permissions');
				});
			}
			return disallow(entity, property);
		}).then(items => multiple ? items : items[0]);

		function disallow(target, key) {
			if (!target[key]) return;
			// target[key] may be a loopback List, can not cloneDeep directly
			let permissions = _.map(target[key], _.cloneDeep);
			_.forEach(subjects, subject => {
				if (!subject) return;
				const permission = _.find(permissions, p => p.subject === subject);
				if (!permission) return;
				if (!_.isEmpty(permission.actions)) {
					permission.actions = actions === '*' ? null : _.without(permission.actions, ...actions);
				}
				if (_.isEmpty(permission.actions)) {
					_.remove(permissions, p => p.subject === subject);
				}
				if (_.isEmpty(permissions)) {
					permissions = null;
				}
			});
			return update(target, key, permissions);
		}
	};

	acl.removeEntitiesPermissions = function (entities) {
		const multiple = Array.isArray(entities);
		entities = schema.apply('entities', entities);

		entities = _.uniq(arrify(entities));

		return PromiseA.map(entities, entity => {
			if (!entity) return;
			if (!dirty || _.isString(entity) || _.isFunction(entity)) {
				let {type: entityType, id: entityId} = utils.typeid(entity);
				entityId = entityId || null;
				const data = {entityType, entityId};
				return SecEntity.destroyAll(data);
			}

			// dirty mode
			// entity[property] = null;
			return update(entity, property, null);
		}).then(items => multiple ? items : items[0]);
	};

	acl.removeSubjectsPermissions = function (subjects, models) {
		schema.apply('subjects', subjects);
		if (models) schema.apply('models', models);

		models = models ? arrify(subjects) : _.values(acl.securedModels);
		subjects = _.uniq(arrify(subjects)).map(item => utils.identify(item)).filter(_.identity);
		return PromiseA.map(models, m => {
			if (!_.isFunction(_.get(m, '_nsec.removeSubjectsPermissions'))) {
				return console.warn('nsec - no removeSubjectsPermissions function is attached to model %s, ' +
					'maybe it is not been secured', m.modelName);
			}
			return m._nsec.removeSubjectsPermissions(subjects);
		});
	};

	acl.hasPermission = function (subjects, entity, actions) {
		subjects = schema.apply('subjects', subjects);
		entity = schema.apply('entity', entity);
		actions = schema.apply('actions', actions);

		return PromiseA.map(arrify(subjects), subject => _.union([subject], arrify(findCorrelatedSubjects(subject))))
			.then(_.flatten).then(subjects => _hasPermission(subjects, entity, actions));
	};

	// ---------------------------------------
	// Internal Functions
	// ---------------------------------------

	function _hasPermission(subjects, entity, actions) {
		subjects = _.uniq(arrify(subjects)).map(item => utils.identify(item)).filter(_.identity);
		actions = _.uniq(arrify(actions)).map(_.toUpper);

		if (_.isEmpty(subjects)) {
			return PromiseA.resolve(false);
		}
		if (!entity || _.isEmpty(actions)) {
			return PromiseA.resolve(true);
		}

		if (!dirty || _.isString(entity)) {
			const {type: entityType, id: entityId} = utils.typeid(entity);
			const data = {entityType, entityId};
			return PromiseA.resolve(SecEntity.findOne({where: data})).then(inst => {
				if (!inst) return true;
				return hasPermission(inst, 'permissions');
			});
		}

		return PromiseA.resolve(hasPermission(entity, property));

		function hasPermission(target, key) {
			const permissions = target[key];
			if (_.isEmpty(permissions)) {
				return true;
			}

			return Boolean(_.find(subjects, subject => {
				const permission = _.find(permissions, p => p.subject === subject);
				if (!permission) {
					return false;
				}
				if (_.find(permission.actions, action => action === '*' || action === 'ALL')) {
					return true;
				}
				actions = actions.filter(action => !_.includes(permission.actions, action));
				return !actions.length;
			}));
		}
	}

	// TODO update permission with a update version or update time restrict for concurrent execution
	function update(entity, property, value) {
		if (!_.isFunction(entity.updateAttribute)) {
			entity[property] = value;
			return entity;
		}

		return PromiseA.fromCallback(cb => entity.updateAttribute(property, value, cb));
	}
};

