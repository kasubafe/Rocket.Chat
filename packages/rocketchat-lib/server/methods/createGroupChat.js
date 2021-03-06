Meteor.methods({
	createGroupChat(name, members, readOnly = false, customFields = {}, extraData = {}) {
		check(name, String);
		check(members, Match.Optional([String]));

		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'createGroupChat' });
		}

		if (!RocketChat.authz.hasPermission(Meteor.userId(), 'create-g')) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'createGroupChat' });
		}

		// validate extra data schema
		check(extraData, Match.ObjectIncluding({
			tokenpass: Match.Maybe({
				require: String,
				tokens: [{
					token: String,
					balance: String
				}]
			})
		}));

		return RocketChat.createRoom('g', name + '-' + Random.id(), Meteor.user() && Meteor.user().username, members, readOnly, {customFields, ...extraData});
	}
});
