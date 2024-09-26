const logger = require('./logger')('StatusChanger');
const electron = require('electron');
const ipcMain = electron.ipcMain;

const STATUSES = ['o', 'a', 'i'];

function StatusChanger (context) {
	this.context = context;
	this.locked = false;
	this.status = 'i';

	this._addMenuItems();

	this.changeStatusMenuItem = new electron.MenuItem({
		label   : 'Status',
		type    : 'submenu',
		submenu : this.changeStatusMenu
	});

	this.context.events.on('agentStatusChanged', (newStatus) => {
		this.onStatusChanged(newStatus);
	});

	this.context.events.on('clearState', () => {
		logger.info('Got message to clear state');
		this.disable();
	});

	ipcMain.on('navigatorStatusChanged', (event, status) => {
		if (status === 'offline') {
			this.disable();
		}
	});
}

module.exports = StatusChanger;

StatusChanger.prototype._addMenuItems = function() {
	this.changeStatusMenu = new electron.Menu();

	this.statusOnlineMenuItem = new electron.MenuItem({
		type    : 'radio',
		label   : 'Online',
		click   : this.setNewStatus.bind(this, 'o'),
		enabled : false
	});

	this.statusAwayMenuItem = new electron.MenuItem({
		type    : 'radio',
		label   : 'Away',
		click   : this.setNewStatus.bind(this, 'a'),
		enabled : false
	});

	this.statusInvisibleMenuItem = new electron.MenuItem({
		type    : 'radio',
		label   : 'Invisible',
		click   : this.setNewStatus.bind(this, 'i'),
		enabled : false
	});

	this.changeStatusMenu.append(this.statusOnlineMenuItem);
	this.changeStatusMenu.append(this.statusAwayMenuItem);
	this.changeStatusMenu.append(this.statusInvisibleMenuItem);
};

StatusChanger.prototype.enable = function() {
	this.changeStatusMenu.items.forEach(function(item) {
		item.enabled = true;
	});
};

StatusChanger.prototype.disable = function() {
	this.changeStatusMenu.items.forEach(function(item) {
		item.enabled = false;
	});
};

StatusChanger.prototype.getMenu = function() {
	return this.changeStatusMenuItem;
};

StatusChanger.prototype.setNewStatus = function(newStatus) {
	if(this.locked === true) {
		logger.info('Set status menu locked');
		return;
	}

	this.disable();

	logger.info('Will set new status', {
		status : newStatus
	});

	this.context.sendRemoteMessage('changeAgentStatus', [newStatus], (error) => {
		this.enable();

		if (error) {
			logger.error('UI responded with error', {
				error : error
			});

			return this.onStatusChanged(this.status);
		}

		this.onStatusChanged(newStatus);
	});
};

StatusChanger.prototype.onStatusChanged = function(newStatus) {
	logger.info('Will set menu item values for new status', {
		status : newStatus
	});

	if (STATUSES.indexOf(newStatus) === -1) {
		return logger.error('Got invalid status value', {
			newStatus : newStatus
		});
	}

	this.locked = true;

	this.statusOnlineMenuItem.checked = false;
	this.statusAwayMenuItem.checked = false;
	this.statusInvisibleMenuItem.checked = false;

	switch(newStatus) {
		case 'o' :
			this.statusOnlineMenuItem.checked = true;
			break;
		case 'a' :
			this.statusAwayMenuItem.checked = true;
			break;
		case 'i' :
			this.statusInvisibleMenuItem.checked = true;
			break;
	}

	this.enable();
	this.status = newStatus;
	this.locked = false;
};
