const logger = require('./logger')('Application');
const path = require('path');
const url = require('url');
const async = require('async');
const EventEmitter = require('events').EventEmitter;

// Electron modules
const { app, BrowserWindow, ipcMain, session, Tray, Menu, MenuItem, screen } = require('electron');

const DASHBOARD_URL = 'https://dashboard.tawk.to';
const DASHBOARD_DOMAIN = url.parse(DASHBOARD_URL).host;
const SECURE_COOKIES = url.parse(DASHBOARD_URL).protocol === 'https:';

/**
 * Main application
 * @param {Object} context Electron application context
 */
function Application() {
	this.window = null;
	this.frame = null;
	this.willQuitApp = false;
	this.paypalWindow = null;
	this.webrtcWindow = null;
	this.callbackId = 1;
	this.callbacks = {};
	this.events = new EventEmitter();

	// load application modules
	this.statusChanger = new (require('./statusChanger'))(this);
	this.updater = new (require('./updater'))(this);
	this.autoStarter = new (require('./autoStarter'))(this);
	this.about = new (require('./about'))(this);

	ipcMain.on('getDashboardUrl', (event) => {
		event.returnValue = DASHBOARD_URL;
	});

	ipcMain.on('remoteMessage', (event, data) => {
		this.onRemoteMessage(event, data);
	});
}

module.exports = Application;

/**
 * Initialize application session
 */
Application.prototype.initializeSession = async function (callback) {
	await session.defaultSession.cookies.set({
		url      : DASHBOARD_URL,
		name     : 'isDesktopApp',
		value    : 'y',
		domain   : DASHBOARD_DOMAIN,
		path     : '/',
		secure   : SECURE_COOKIES,
		httpOnly : false
	});

	await session.defaultSession.cookies.set({
		url      : DASHBOARD_URL,
		name     : 'desktopAppVersion',
		value    : app.getVersion(),
		domain   : DASHBOARD_DOMAIN,
		path     : '/',
		secure   : SECURE_COOKIES,
		httpOnly : true
	});

	await session.defaultSession.cookies.set({
		url      : DASHBOARD_URL,
		name     : 'isPaypalFriendly',
		value    : 'y',
		domain   : DASHBOARD_DOMAIN,
		path     : '/',
		secure   : SECURE_COOKIES,
		httpOnly : false
	});

	await session.defaultSession.cookies.set({
		url      : DASHBOARD_URL,
		name     : 'isWebRTCFriendly',
		value    : 'y',
		domain   : DASHBOARD_DOMAIN,
		path     : '/',
		secure   : SECURE_COOKIES,
		httpOnly : false
	});
};

/**
 * Initialize application tray
 */
Application.prototype.initializeTray = function() {
	const tray = new Tray(path.join(__dirname, '../app/assets/images/tawky.png'));

	const menu = new Menu();

	menu.append(this.statusChanger.getMenu());
	menu.append(this.updater.getMenu());
	menu.append(this.autoStarter.getMenu());
	menu.append(this.about.getMenu());

	menu.append(new MenuItem({
		type : 'separator'
	}));

	menu.append(new MenuItem({
		label : 'Quit',
		click : () => {
			this.willQuitApp = true;
			app.quit();
		}
	}));

	tray.setToolTip('tawk.to');

	tray.on('right-click', () => {
		tray.popUpContextMenu(menu);
	});

	tray.on('click', () => {
		this.window.show();
	});
};

/**
 * Initialize main application window
 */
Application.prototype.initializeWindow = async function () {
	const {width, height} = screen.getPrimaryDisplay().workAreaSize;

	this.initializeTray();

	this.window = new BrowserWindow({
		width  : Math.round(width * 0.9),
		height : Math.round(height * 0.9),
		center : true,
		icon   : path.join(__dirname, '../app/assets/images/tawky.ico'),
		webPreferences: {
			nodeIntegration: true
		}
	});

	this.frame = this.window.webContents;

	this.window.on('before-quit', () => {
		this.willQuitApp = true;
	});

	this.window.on('close', (event) => {
		if (!this.willQuitApp) {
			event.preventDefault();
			this.window.hide();
		}
	});

	this.window.on('closed', () => {
		this.frame = null;
		this.window = null;
	});

	this.window.on('blur', () => {
		this.sendRemoteMessage('appWindowFocus', [false]);
	});

	this.window.on('focus', () => {
		this.sendRemoteMessage('appWindowFocus', [true]);
	});

	this.frame.on('new-window', function(event, url) {
		event.preventDefault();
		require('electron').shell.openExternal(url);
	});

	this.events.on('requestWindowIsFocused', () => {
		if (this.window !== null) {
			this.sendRemoteMessage('appWindowFocus', [this.window.isFocused()]);
		}
	});

	this.events.on('maximizeWindow', () => {
		if (this.window !== null) {
			this.window.show();
		}
	});

	this.events.on('desktopNotification', (data) => {
		this.frame.send('desktopNotification', data);
	});

	this.events.on('notificationClicked', (data) => {
		if (this.window !== null) {
			this.window.show();
		}

		this.sendRemoteMessage('notificationClicked', [
			{
				messageId : data.messageId,
				type: data.type,
				propertyId: data.propertyId,
				ticketId: data.ticketId
			}
		]);
	});

	this.events.on('paypal', (url) => {
		if (this.paypalWindow === null) {
			this.paypalWindow = new BrowserWindow({
				width  : Math.round(width * 0.9),
				height : Math.round(height * 0.9),
				center : true,
				parent : this.window,
				show   : false,
				title  : 'Paypal'
			});

			this.paypalWindow.once('ready-to-show', () => {
				this.paypalWindow.show();
			});

			this.paypalWindow.once('closed', () => {
				if (this.paypalWindow._willClose !== true) {
					this.sendRemoteMessage('paypalWindowClosed', []);
				}

				this.paypalWindow = null;
			});
		}

		this.paypalWindow.setMenu(null);
		this.paypalWindow.loadURL(url);
	});

	this.events.on('closePayPalWindow', () => {
		if (this.paypalWindow !== null) {
			this.paypalWindow._willClose = true;
			this.paypalWindow.close();
		}
	});

	this.events.on('openWebRTCCAll', (url) => {
		if (this.webrtcWindow !== null) {
			this.sendRemoteMessage('hasOngoingWebRTCCallReply', []);
			return;
		}

		this.webrtcWindow = new BrowserWindow({
			width  : Math.round(width * 0.9),
			height : Math.round(height * 0.9),
			center : true,
			show   : false,
			title  : 'Voice + Video + Screenshare'
		});

		this.webrtcWindow.once('ready-to-show', () => {
			this.webrtcWindow.show();
		});

		this.webrtcWindow.once('closed', () => {
			this.webrtcWindow = null;
		});

		this.webrtcWindow.setMenu(null);
		this.webrtcWindow.loadURL(url);
	});

	try {
		await this.initializeSession();
	} catch (error) {

	}

	this.window.loadURL(url.format({
		pathname : path.join(__dirname, '../app/html/index.html'),
		protocol : 'file:',
		slashes  : true
	}));

	this.window.setMenu(null);

	this.updater.checkForUpdates();
};

/**
 * Start application
 */
Application.prototype.start = function() {
	if (this.window === null) {
		this.initializeWindow();
	} else {
		this.window.show();
	}
};

/**
 * Send remote message
 * @param  {Object} event Event object
 * @param  {Object} data  Event data
 */
Application.prototype.onRemoteMessage = function(event, data) {
	if (typeof data !== 'object') {
		return logger.error('Got message with invalid payload, expecting object but got something else', {
			type : typeof data,
			data : data
		});
	}

	if (data.cmd === undefined) {
		return logger.error('Got message with missing command', {
			data : data
		});
	}

	if (data.payload !== undefined && !Array.isArray(data.payload)) {
		return logger.error('Got message with payload which isnt array', {
			data : data
		});
	}

	if (data.cb !== undefined && this.callbacks[data.cb] === undefined) {
		return logger.error('Got message with already used callback', {
			data : data
		});
	}

	logger.info('Got remote message', data);

	if (data.cb !== undefined) {
		this.callbacks[data.cb].apply(null, Array.isArray(data.payload) ? data.payload : []);
		delete this.callbacks[data.cb];
	} else {
		this.events.emit.apply(this.events, [data.cmd].concat(Array.isArray(data.payload) ? data.payload : []));
	}
};

/**
 * Send remote message
 * @param  {String}   command  Command
 * @param  {Array}    payload  Payload
 * @param  {Function} callback Callback
 */
Application.prototype.sendRemoteMessage = function(command, payload, callback) {
	let error ;

	if (this.frame === null) {
		error = new Error('Application frame is not ready');
	}

	if (command === undefined) {
		error = new Error('Tried to send message without valid command');
	}

	if (!Array.isArray(payload)) {
		error = new Error('Tried to send message without valid payload');
	}

	if (error !== undefined) {
		if (typeof callback === 'function') {
			return callback(error);
		}

		return logger.error(error);
	}

	const sendPayload = {
		cmd     : command,
		payload : payload
	};

	if (typeof callback === 'function') {
		this.callbacks[this.callbackId] = callback;
		sendPayload.cb = this.callbackId;
		this.callbackId += 1;
	}

	this.frame.send('remoteMessage', JSON.stringify(sendPayload));
};

Application.prototype.updateProgressBar = function(progress) {
	var progressValue = (progress / 100);
	this.window.setProgressBar(progressValue)
};