const fs = require('fs');
const csv = require('csv-parser');
const moment = require('moment');

// Функция задержки
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Функция логирования
const logger = function (domain = 'utils', msg) {
    const dirName = '../logs';
    const fileName = 'logs-' + domain + '-' + moment().format('YYYY-MM-DDTHH') + '.log';
    const path = dirName + '/' + fileName;
    const line = moment().format('YYYY-MM-DDTHH:mm:ss') + '-' + '[INFO]' + '-' + msg;
    fs.appendFileSync(path, line + '\n');
    console.log(line);
    return {};
}

// Функция для получения прокси
async function getProxies() {
    const proxies = [
        `http://185.68.152.9:${25000 + Math.floor(Math.random() * 4999)}`,
    ];
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    logger('utils', `Выбран прокси: ${proxy}`); // Логируем с domain = 'utils'
    return proxy;
}

// Функция инициализации браузера
async function init() {
    const proxy = await getProxies();
    return {
        args: [
            '--proxy-server=' + proxy,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1800,700'
        ],
        headless: false,
        timeout: 60000,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        defaultViewport: null
    };
}

// Функция для чтения CSV
async function readCSV(filePath, domain = 'utils') {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                logger(domain, `Файл ${filePath} успешно загружен, найдено ${results.length} записей.`);
                resolve(results);
            })
            .on('error', (error) => {
                logger(domain, `Ошибка при чтении CSV: ${error}`);
                reject(error);
            });
    });
}

// Функция для записи CSV
function appendCSV(filePath, data, domain = 'utils') {
    const headers = 'Регион;Торговый центр;Адрес;Дата сбора\n';
    const row = `${data["Регион"]};${data["Торговый центр"]};${data["Адрес"]};${data["Дата сбора"]}\n`;

    // Если файл не существует, записываем заголовок
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, headers);
    }
    fs.appendFileSync(filePath, row);
}

// Функция для установки cookies
async function setCookies(page, cookies, domain = 'utils') {
    if (cookies && cookies.length > 0) {
        await page.setCookie(...cookies);
        logger(domain, `Установлены куки: ${JSON.stringify(cookies)}`);
    }
}

// Функция для перехода на страницу
async function goto(page, url, waitSelector, waitUntil, domain = 'utils') {
    let reloads = 0;
    let success = false;
    logger(domain, `Переход на страницу: ${url}`);
    while (reloads < 15 && !success) {
        try {
            await page.goto(url, { waitUntil: waitUntil || 'networkidle2', timeout: 30000 });
            await delay(10000);
            await page.waitForSelector(waitSelector);
            logger(domain, `Успешно загружена страница ${url}`);
            success = true;
        } catch (err) {
            reloads++;
            logger(domain, `Ошибка загрузки страницы ${url}, попытка ${reloads}/15: ${err}`);
            await page.reload();
        }
    }
    return success;
}

// Экспорт всех функций
module.exports = { delay, readCSV, appendCSV, goto, setCookies, init, logger };