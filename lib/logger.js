const winston = require('winston');

module.exports = function (label) {
	const logger = new (winston.Logger)();

	if (process.env._TAWK_DEBUG_) {
		logger.add(winston.transports.Console, {
			colorize    : true,
			prettyPrint : true,
			timestamp   : true,
			label       : label
		});
	}

	return logger;
};
