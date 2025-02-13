const fs = require('fs');
const csv = require('csv-parser');
const moment = require('moment');
const logger = require("./logger");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getProxies() {
    const proxies = [
        `http://185.68.152.9:${25000 + Math.floor(Math.random() * 4999)}`,
    ];
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    logger(`Выбран прокси: ${proxy}`);
    return proxy;
}

async function readCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                logger(`Файл ${filePath} успешно загружен, найдено ${results.length} записей.`);
                resolve(results);
            })
            .on('error', (error) => {
                logger(`Ошибка при чтении CSV: ${error}`);
                reject(error);
            });
    });
}

function writeCSV(filePath, data) {
    if (data.length === 0) {
        logger(`Нет данных для сохранения в ${filePath}`);
        return;
    }
    const header = 'Регион,Торговый центр,Адрес,Дата сбора\n';
    const rows = data.map(r => `${r["Регион"]},${r["Торговый центр"]},${r["Адрес"]},${r["Дата сбора"]}`).join('\n');
    fs.writeFileSync(filePath, header + rows);
    logger(`Файл ${filePath} успешно сохранен (${data.length} записей).`);
}

async function setCookies(page, cookies) {
    if (cookies && cookies.length > 0) {
        await page.setCookie(...cookies);
        logger(`Установлены куки: ${JSON.stringify(cookies)}`);
    }
}

async function goto(page, url, waitSelector, waitUntil) {
    let reloads = 0;
    let success = false;
    logger(`Переход на страницу: ${url}`);
    while (reloads < 15 && !success) {
        try {
            await page.goto(url, { waitUntil: waitUntil || 'networkidle2', timeout: 30000 });
            await delay(10000);
            await page.waitForSelector(waitSelector);
            logger(`Успешно загружена страница ${url}`);
            success = true;
        } catch (err) {
            reloads++;
            logger(`Ошибка загрузки страницы ${url}, попытка ${reloads}/15: ${err}`);
            await page.reload();
        }
    }
    return success;
}

module.exports = { delay, getProxies, readCSV, writeCSV, goto, setCookies };
