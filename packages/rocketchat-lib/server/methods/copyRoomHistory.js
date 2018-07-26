Meteor.methods({
	copyRoomHistory(sourceRoomId, destRoomId, lengthInSeconds) {
		check(sourceRoomId, String);
		check(destRoomId, String);
		check(lengthInSeconds, Number);

		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'copyRoomHistory' });
		}

		const fromUserId = Meteor.userId();
		const fromUserName = Meteor.user().username;
		const sourceRoom = Meteor.call('canAccessRoom', sourceRoomId, fromUserId);
		if (!sourceRoom) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'copyRoomHistory' });
		}
		const destRoom = Meteor.call('canAccessRoom', destRoomId, fromUserId);
		if (!destRoom) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'copyRoomHistory' });
		}

		// We only allow copying of messages between rooms the user is part of, and only from direct chats into group chats.
		if (sourceRoom.t !== 'd' || sourceRoom.usernames.indexOf(fromUserName) === -1) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'copyRoomHistory' });
		}
		if (destRoom.t !== 'g' || destRoom.usernames.indexOf(fromUserName) === -1) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', { method: 'copyRoomHistory' });
		}

		// Limit whatever the client sends to a maximum configured server-side.
		lengthInSeconds = Math.min(lengthInSeconds, RocketChat.settings.get('Message_CopyHistoryAmount_Seconds'));
		if (lengthInSeconds < 1) {
			return true; // Nothing to do.
		}

		const latest = new Date();
		const oldest = new Date(latest - lengthInSeconds*1000);

		RocketChat.models.Messages.find({
			rid: sourceRoomId,
			ts: {
				$gt: oldest,
				$lt: latest
			}
		}).forEach((message) => {
			delete message._id;
			message.rid = destRoomId;
			RocketChat.models.Messages.insert(message);
		});
	}
});
