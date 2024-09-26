const electron = require('electron');
const dialog = electron.dialog;
const { autoUpdater } = require('electron-updater');
const path = require('path');
const logger = require('./logger')('Updater');

function Updater(application) {

	this.checkUpdateMenu = new electron.MenuItem({
		label : 'Check for updates',
		click : () => {
			this.checkForUpdates(true);
		}
	});

	autoUpdater.autoDownload = false;

	autoUpdater.on('checking-for-update', () => {
		logger.info('Checking for update...');
	});

	autoUpdater.on('update-available', () => {
		dialog.showMessageBox({
			type    : 'info',
			title   : 'Update Available',
			message : 'A new version of the tawk.to app is available. Would like to update now?',
			buttons : ['Yes', 'Cancel'],
			icon    : path.join(__dirname, '../app/assets/images/small-tawky.png')
		}).then(result  => {
			if (result.response === 0) {
				autoUpdater.downloadUpdate();
			} else {
				this.isManualCheck = false;
				this.checkUpdateMenu.enabled = true;
			}
		}).catch(err => {
			console.log(err)
		});
	});

	autoUpdater.on('update-not-available', () => {
		if (this.isManualCheck) {
			dialog.showMessageBox({
				type    : 'info',
				title   : 'Check for Update',
				message : 'tawk.to app is already up to date.',
				buttons : [],
				icon    : path.join(__dirname, '../app/assets/images/small-tawky.png')
			});
		}

		this.isManualCheck = false;
		this.checkUpdateMenu.enabled = true;
	});

	autoUpdater.on('error', (err) => {
		if (this.isManualCheck) {
			dialog.showMessageBox({
				type    : 'error',
				title   : 'Update Error',
				message : 'Unable to download the update for tawk.to app. Please try again.',
				buttons : [],
				icon    : path.join(__dirname, '../app/assets/images/small-tawky.png')
			});
		}

		logger.error('Error in auto-updater.', err);

		this.isManualCheck = false;
		this.checkUpdateMenu.enabled = true;
	});

	autoUpdater.on('download-progress', (progressObj) => {
		let log_message = "Download speed: " + progressObj.bytesPerSecond;
		log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
		log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
		logger.info(log_message);

		application.updateProgressBar(progressObj.percent);
	});

	autoUpdater.on('update-downloaded', () => {
		logger.info('Update downloaded');

		dialog.showMessageBox({
			type    : 'info',
			title   : 'Update Downloaded',
			message : 'Restart app and install update?',
			buttons : ['Yes', 'Cancel'],
			icon    : path.join(__dirname, '../app/assets/images/small-tawky.png')
		}).then(result => {
			if (result.response === 0) {
				application.willQuitApp = true;
				autoUpdater.quitAndInstall();
			}
		}).catch(err => {
			console.log(err)
		});
	});
}

module.exports = Updater;

Updater.prototype.getMenu = function() {
	return this.checkUpdateMenu;
};

Updater.prototype.checkForUpdates = function(isManualCheck) {
	this.checkUpdateMenu.enabled = false;
	this.isManualCheck = !!isManualCheck;

	autoUpdater.checkForUpdates();
	logger.info('Checking for updates');
};
