const puppeteer = require('puppeteer-extra');
const logger = require("../logger");
const { delay, readCSV, writeCSV, goto,getProxies } = require("../utils");
const moment = require('moment');

const inputFile = '../temp/city.csv';
const outputFile = '../temp/zenden.address.csv';

async function init() {
    const proxy = await getProxies();
    return {
        args: [
            '--proxy-server=' + proxy,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            // '--start-maximized'
        ],
        headless: false,
        timeout: 60000,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        defaultViewport: null,
    };
}

async function extractShops(page, city) {
    try {
        logger(`Начинаем сбор данных для города: ${city}`);

        await page.click('.shops-standalone__group-item .js-cityModalOpenButton');
        await delay(5000);

        await page.waitForSelector('.city-modal__search .js-cityModalInput');
        await page.type('.city-modal__search .js-cityModalInput', city, { delay: 700 });
        await delay(5000);

        await page.waitForSelector('.city-modal__list div[data-params]');
        await page.click('.city-modal__list div[data-params]');
        await delay(5000);

        let results = [];
        const shopCards = await page.$$('#shops-map .shop-card');

        if (shopCards.length === 0) {
            logger(`Магазины в городе ${city} не найдены.`);
            return results;
        }

        logger(`Найдено ${shopCards.length} магазинов в городе ${city}.`);

        for (const shopCard of shopCards) {
            const addressLines = await shopCard.$$eval('.shop-card__address .shop-card__line', nodes => nodes.map(n => n.textContent.trim()));
            if (addressLines.length > 1) {
                const mall = addressLines[0];
                const address = addressLines[1];

                const data = {
                    "Регион": city,
                    "Торговый центр": mall,
                    "Адрес": address,
                    "Дата сбора": moment().format('DD.MM.YYYY'),
                };

                results.push(data);
                logger(` Собран магазин: ${JSON.stringify(data)}`);
            }
        }

        return results;
    } catch (err) {
        logger(`Ошибка при парсинге города ${city}: ${err}`);
        return [];
    }
}

(async () => {
    try {
        logger(`Запуск парсинга Zenden`);
        const cities = await readCSV(inputFile);
        const browser = await puppeteer.launch(await init());
        const page = await browser.newPage();

        if (!await goto(page, 'https://zenden.ru/shops', '.shops-standalone__group-item', 'domcontentloaded')) {
            return;
        }

        let results = [];
        for (const row of cities) {
            logger(`Обрабатываем город: ${row.city}`);
            const cityResults = await extractShops(page, row.city);
            results.push(...cityResults);
        }

        writeCSV(outputFile, results);
        await browser.close();
        logger(`✅ Парсинг завершён. Данные сохранены в ${outputFile}`);
    } catch (err) {
        logger(`Критическая ошибка: ${err}`);
    }
})();
