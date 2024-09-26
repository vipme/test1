const electron      = require('electron');
const BrowserWindow = electron.BrowserWindow;
const path          = require('path');
const url           = require('url');

function AboutUs () {
	this.window = null;
	this.menu = new electron.MenuItem({
		label : 'About',
		click : () => {
			this.show();
		}
	});
}

module.exports = AboutUs;

AboutUs.prototype.getMenu = function() {
	return this.menu;
};

AboutUs.prototype.show = function() {
	if(this.window === null) {
		this._createNewWindow();
	} else {
		this._showExistingWindow();
	}
};

AboutUs.prototype._showExistingWindow = function() {
	this.window.show();
	this.window.focus();
};

AboutUs.prototype._createNewWindow = function() {
	this.window = new BrowserWindow({
		width     : 300,
		height    : 200,
		center    : true,
		resizable : false,
		icon      : path.join(__dirname, '../app/assets/images/small-tawky.png'),
		title     : 'About',
		webPreferences: {
			nodeIntegration: true
		}
	});

	this.window.setMenu(null);

	this.window.loadURL(url.format({
		pathname : path.join(__dirname, '../app/html/about.html'),
		protocol : 'file:',
		slashes  : true
	}));

	this.window.on('closed', () => {
		this.window = null;
	});
};
