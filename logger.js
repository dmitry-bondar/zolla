const fs = require("fs");
const moment = require('moment');
const dirName = '../logs'
const fileName = 'logs-' + moment().format('YYYY-MM-DDTHH') + '.log'
const path = dirName + '/' + fileName

const logger = function (msg) {
    const line = moment().format('YYYY-MM-DDTHH:mm:ss') + '-' + '[INFO]' + '-' + msg;
    fs.appendFileSync(path, line + '\n');
    console.log(line);
    return {}
}
module.exports = logger
