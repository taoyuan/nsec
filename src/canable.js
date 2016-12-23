const _ = require('lodash');
const PromiseA = require('bluebird');
const arrify = require('arrify');
const schema = require('./schema');
const secure = require('./secure');
const utils = require('./utils');

module.exports = function (sec, opts) {
	const {SecEntity} = sec.models;
	let {dirty, property, findCorrelatedSubjects} = opts;
	findCorrelatedSubjects = findCorrelatedSubjects || _.noop;

	sec.allow = function (subjects, entities, actions) {
		subjects = schema.apply('subjects', subjects);
		entities = schema.apply('entities', entities);
		actions = schema.apply('actions', actions);

		const multiple = Array.isArray(entities);
		subjects = _.uniq(arrify(subjects)).map(item => utils.identify(item)).filter(_.identity);
		entities = _.uniq(arrify(entities));
		actions = _.uniq(arrify(actions));

		if (_.isEmpty(subjects) ||
			_.isEmpty(entities) ||
			_.isEmpty(actions)) {
			return PromiseA.resolve();
		}

		return PromiseA.map(entities, entity => {
			if (!entity) return;
			if (!dirty || _.isString(entity)) {
				const {type: entityType, id: entityId} = utils.typeid(entity);
				const data = {entityType, entityId};
				return SecEntity.findOrCreate({where: data}, data).then(([inst]) => allow(inst, 'permissions'));
			}
			return allow(entity, property);
		}).then(items => multiple ? items : items[0]);

		function allow(target, key) {
			const permissions = target[key] || [];
			_.forEach(subjects, subject => {
				if (!subject) return;
				let permission = _.find(permissions, p => p.subject === subject);
				if (!permission) {
					permission = {subject};
					permissions.push(permission);
				}
				permission.actions = _.union(permission.actions || [], actions);
			});
			target[key] = permissions;
			return saveEntity(target);
		}
	};

	sec.disallow = function (subjects, entities, actions) {
		subjects = schema.apply('subjects', subjects);
		entities = schema.apply('entities', entities);

		if (_.isNil(actions) || actions === '*' || actions === 'all') {
			actions = '*';
		} else {
			actions = schema.apply('actions', actions);
			actions = _.uniq(arrify(actions));
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
			if (!dirty || _.isString(entity)) {
				const {type: entityType, id: entityId} = utils.typeid(entity);
				const data = {entityType, entityId};
				return SecEntity.findOne({where: data}).then(inst => {
					if (inst) return disallow(inst, 'permissions');
				});
			}
			return disallow(entity, property);
		}).then(items => multiple ? items : items[0]);

		function disallow(target, key) {
			if (!target[key]) return;
			const permissions = target[key];
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
					target[key] = null;
				}
			});
			return saveEntity(target);
		}
	};

	sec.remove = function (entities) {
		const multiple = Array.isArray(entities);
		entities = schema.apply('entities', entities);

		entities = _.uniq(arrify(entities));

		return PromiseA.map(entities, entity => {
			if (!entity) return;
			if (!dirty || _.isString(entity)) {
				const {type: entityType, id: entityId} = utils.typeid(entity);
				const data = {entityType, entityId};
				return SecEntity.destroyAll(data);
			}

			// dirty mode
			entity[property] = null;
			return saveEntity(entity);
		}).then(items => multiple ? items : items[0]);
	};

	sec.can = function (subjects, entity, actions) {
		subjects = schema.apply('subjects', subjects);
		entity = schema.apply('entity', entity);
		actions = schema.apply('actions', actions);

		return PromiseA.map(arrify(subjects), subject => _.union([subject], arrify(findCorrelatedSubjects(subject))))
			.then(_.flatten).then(subjects => _can(subjects, entity, actions));
	};

	sec.cannot = function (subjects, entity, actions) {
		subjects = schema.apply('subjects', subjects);
		entity = schema.apply('entity', entity);
		actions = schema.apply('actions', actions);

		return sec.can(subjects, entity, actions).then(allowed => !allowed);
	};

	/**
	 * Secure a model class for find
	 *
	 * @param {Function} Model model class to secure
 */
	sec.secure = function (Model, options) {
		options = _.defaults(options || {}, opts);
		return secure(Model, options);
	};

	// ---------------------------------------
	// Internal Functions
	// ---------------------------------------

	function _can(subjects, entity, actions) {
		subjects = _.uniq(arrify(subjects)).map(item => utils.identify(item)).filter(_.identity);
		actions = _.uniq(arrify(actions));

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
				return can(inst, 'permissions');
			});
		}

		return PromiseA.resolve(can(entity, property));

		function can(target, key) {
			const permissions = target[key];
			if (_.isEmpty(permissions)) {
				return true;
			}

			return Boolean(_.find(subjects, subject => {
				const permission = _.find(permissions, p => p.subject === subject);
				if (!permission) {
					return false;
				}
				if (_.find(permission.actions, action => action === '*' || action === 'all')) {
					return true;
				}
				actions = actions.filter(action => !_.includes(permission.actions, action));
				return !actions.length;
			}));
		}
	}

	function saveEntity(entity) {
		if (!_.isFunction(entity.save)) {
			return entity;
		}

		if (entity.save.length > 0) {
			return PromiseA.fromCallback(cb => entity.save(cb));
		}
		return entity.save();
	}
};

