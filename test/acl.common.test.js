'use strict';

const assert = require('chai').assert;
const nsec = require('../');

describe('acl/common', () => {
	it('should get current user', () => {
		let acl = nsec({currentUser: () => 'a'});
		assert.equal(acl.getCurrentUserId(), 'a');
		acl = nsec({currentUser: () => ({id: 'b'})});
		assert.equal(acl.getCurrentUserId(), 'b');
		acl = nsec();
		assert.equal(acl.getCurrentUserId({userId: 'c'}), 'c');
		assert.equal(acl.getCurrentUserId({user: 'd'}), 'd');
		assert.equal(acl.getCurrentUserId({user: {id: 'e'}}), 'e');
		assert.equal(acl.getCurrentUserId({accessToken: {userId: 'f'}}), 'f');
	});
});
