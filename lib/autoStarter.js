const storage = require('electron-json-storage');
const electron = require('electron');
const logger = require('./logger')('Autostarter');
const AutoLaunch = require('auto-launch');

function AutoStarter() {
	this.isAutoStartEnabled = false;

	this.autostartMenuItem = new electron.MenuItem({
		type    : 'checkbox',
		label   : 'Start on boot',
		enabled : false,
		click   : this.toggleAutoLaunch.bind(this)
	});

	this.fetchAutoStartEnabled((isEnabled) => {
		this.isAutoStartEnabled = isEnabled;
		this.autostartMenuItem.enabled = true;
		this.autostartMenuItem.checked = isEnabled;
	});

	this.autoLauncher = new AutoLaunch({
		name: 'tawk-to'
	});
}

module.exports = AutoStarter;

AutoStarter.prototype.getMenu = function() {
	return this.autostartMenuItem;
};

AutoStarter.prototype.fetchAutoStartEnabled = function(callback) {
	storage.get('autoStart', function(error, data){
		if (error) {
			return callback(false);
		}

		callback((data && data.enabled === 'y'));
	});
};

AutoStarter.prototype.toggleAutoLaunch = function() {
	const self = this;
	const newEnabled = !this.isAutoStartEnabled;

	this.autostartMenuItem.enabled = false;

	function done (error) {
		self.autostartMenuItem.enabled = true;

		if (error) {
			logger.error('Failed to toggle autostarter value', error);
			return;
		}

		storage.set('autoStart', {
			enabled : newEnabled ? 'y' : 'n'
		}, function(error) {
			if (error) {
				logger.error('Failed to save autostarter value', error);
			}
		});

		self.isAutoStartEnabled = newEnabled;
		self.autostartMenuItem.checked = newEnabled;
	}

	if(this.isAutoStartEnabled) {
		this.autoLauncher.disable().then(done).catch(done);
	} else {
		this.autoLauncher.enable().then(done).catch(done);
	}
};
