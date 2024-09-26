const ipcRenderer = require('electron').ipcRenderer;
const loadingIframe = document.getElementById('loading-iframe');
const offlineIframe = document.getElementById('offline-iframe');
const appIframe = document.getElementById('app-iframe');
const logger = require('../../lib/logger')('MainRenderer');
const path = require('path');

const DASHBOARD_URL = ipcRenderer.sendSync('getDashboardUrl');

function updateOnlineStatus() {
	var isOnline = navigator.onLine;

	ipcRenderer.send('navigatorStatusChanged', isOnline ? 'online' : 'offline');

	if (isOnline) {
		loadingIframe.style.display = 'block';
		offlineIframe.style.display = 'none';

		appIframe.onload = function() {
			loadingIframe.style.display = 'none';
			appIframe.style.display = 'block';

			appIframe.onload = function() {};
		};

		appIframe.src = DASHBOARD_URL;

	} else {

		loadingIframe.style.display = 'none';
		appIframe.style.display     = 'none';
		offlineIframe.style.display = 'block';

		appIframe.onload = function(){};
		appIframe.src = '';
	}
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

ipcRenderer.on('remoteMessage', (event, data) => {
	logger.info('Sending message to frame', data);
	appIframe.contentWindow.postMessage(data, '*');
});

window.addEventListener('message', function onWindowMessage (event) {
	logger.info('Got message from frame', {
		origin : event.origin,
		data   : event.data
	});

	if (event.origin !== DASHBOARD_URL) {
		return logger.info(`Ignoring message because origin mismatch ${event.origin} != ${DASHBOARD_URL}`);
	}

	ipcRenderer.send('remoteMessage', event.data);
});

ipcRenderer.on('desktopNotification', (event, data) => {
	const notificationData = JSON.parse(data);

	if (!notificationData.senderName || !notificationData.message) {
		return;
	}

	const notification = new this.window.Notification(notificationData.senderName, {
		body: notificationData.message,
		icon: path.join(__dirname, '../assets/images/tawky-70w.png'),
	});

	notification.onclick = function() {
		ipcRenderer.send('remoteMessage', {
			cmd : 'notificationClicked',
			payload : [
				{
					messageId : notificationData.messageId,
					type: notificationData.type,
					propertyId: notificationData.propertyId,
					ticketId: notificationData.ticketId
				}
			]
		});
	}
});

updateOnlineStatus();