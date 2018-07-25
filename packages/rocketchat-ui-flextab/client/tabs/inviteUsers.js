import toastr from 'toastr';

const acEvents = {
	'click .rc-popup-list__item'(e, t) {
		t.ac.onItemClick(this, e);
	},
	'keydown [name="users"]'(e, t) {
		if ([8, 46].includes(e.keyCode) && e.target.value === '') {
			const users = t.selectedUsers;
			const usersArr = users.get();
			usersArr.pop();
			return users.set(usersArr);
		}

		t.ac.onKeyDown(e);
	},
	'keyup [name="users"]'(e, t) {
		t.ac.onKeyUp(e);
	},
	'focus [name="users"]'(e, t) {
		t.ac.onFocus(e);
	},
	'blur [name="users"]'(e, t) {
		t.ac.onBlur(e);
	}
};

const filterNames = (old) => {
	if (RocketChat.settings.get('UI_Allow_room_names_with_special_chars')) {
		return old;
	}

	const reg = new RegExp(`^${ RocketChat.settings.get('UTF8_Names_Validation') }$`);
	return [...old.replace(' ', '').toLocaleLowerCase()].filter(f => reg.test(f)).join('');
};

Template.inviteUsers.helpers({
	disabled() {
		return Template.instance().selectedUsers.get().length === 0;
	},
	tAddUsers() {
		return t('Add_users');
	},
	autocomplete(key) {
		const instance = Template.instance();
		const param = instance.ac[key];
		return typeof param === 'function' ? param.apply(instance.ac): param;
	},
	items() {
		return Template.instance().ac.filteredList();
	},
	config() {
		const filter = Template.instance().userFilter.get();
		return {
			filter,
			noMatchTemplate: 'userSearchEmpty',
			modifier(text) {
				const f = filter;
				return `@${ f.length === 0 ? text : text.replace(new RegExp(filter), function(part) {
					return `<strong>${ part }</strong>`;
				}) }`;
			}
		};
	},
	selectedUsers() {
		return Template.instance().selectedUsers.get();
	}
});

Template.inviteUsers.events({

	...acEvents,
	'click .rc-tags__tag'({target}, t) {
		const {username} = Blaze.getData(target);
		t.selectedUsers.set(t.selectedUsers.get().filter(user => user.username !== username));
	},
	'click .rc-tags__tag-icon'(e, t) {
		const {username} = Blaze.getData(t.find('.rc-tags__tag-text'));
		t.selectedUsers.set(t.selectedUsers.get().filter(user => user.username !== username));
	},
	'input [name="users"]'(e, t) {
		const input = e.target;
		const position = input.selectionEnd || input.selectionStart;
		const length = input.value.length;
		const modified = filterNames(input.value);
		input.value = modified;
		document.activeElement === input && e && /input/i.test(e.type) && (input.selectionEnd = position + input.value.length - length);

		t.userFilter.set(modified);
	},
	'click .js-add'(e, instance) {
		const usersToInvite = instance.selectedUsers.get().map(({username}) => username);
		const rid = Session.get('openedRoom');
		const roomData = Session.get(`roomData${ rid }`);
		if (roomData.t === 'd') {
			// We must not add users to direct messages, but we can create a new group chat with the selected people
			Meteor.call('getUsersOfRoom', rid, true, (err, roomUsers) => {
				if (err) {
					return toastr.error(t(err.error));
				}

				let allUsers = [];
				allUsers.push(...usersToInvite);
				allUsers.push(...roomUsers.records.map(({username}) => username));
				let groupChatName = allUsers.sort().join('-');
				Meteor.call('getRoomIdByNameOrId', groupChatName, function(err, result) {
					if (err) {
						// The room either doesn't exist, or we do not have the rights to see it.
						// We try to create it, assuming it does not exist. The group name contains our user name, so we should have rights to see it if it exists.
						Meteor.call('createGroupChat', groupChatName, allUsers, false, {}, {}, function(err, result) {
							if (err) {
								return toastr.error(t(err.error));
							}

							return FlowRouter.go('groupchat', { name: result.name }, FlowRouter.current().queryParams);
						});
					} else {
						return FlowRouter.go('groupchat', { name: groupChatName }, FlowRouter.current().queryParams);
					}
				});
			});
			instance.selectedUsers.set([]);
		} else {
			Meteor.call('addUsersToRoom', {
				rid: rid,
				usersToInvite
			}, function(err) {
				if (err) {
					return toastr.error(err);
				}
				toastr.success(t('Users_added'));
				instance.selectedUsers.set([]);
			});
		}
	}
});

Template.inviteUsers.onRendered(function() {
	const users = this.selectedUsers;

	this.firstNode.querySelector('[name="users"]').focus();
	this.ac.element = this.firstNode.querySelector('[name="users"]');
	this.ac.$element = $(this.ac.element);
	this.ac.$element.on('autocompleteselect', function(e, {item}) {
		const usersArr = users.get();
		usersArr.push(item);
		users.set(usersArr);
	});
});
/* global AutoComplete Deps */
Template.inviteUsers.onCreated(function() {
	this.selectedUsers = new ReactiveVar([]);
	const filter = {exceptions :[Meteor.user().username].concat(this.selectedUsers.get().map(u => u.username))};
	Deps.autorun(() => {
		filter.exceptions = [Meteor.user().username].concat(this.selectedUsers.get().map(u => u.username));
	});
	this.userFilter = new ReactiveVar('');

	this.ac = new AutoComplete({
		selector:{
			item: '.rc-popup-list__item',
			container: '.rc-popup-list__list'
		},

		limit: 10,
		inputDelay: 300,
		rules: [{
			// @TODO maybe change this 'collection' and/or template
			collection: 'UserAndRoom',
			subscription: 'userAutocomplete',
			field: 'username',
			matchAll: true,
			filter,
			doNotChangeWidth: false,
			selector(match) {
				return { term: match };
			},
			sort: 'username'
		}]
	});
	this.ac.tmplInst = this;
});
