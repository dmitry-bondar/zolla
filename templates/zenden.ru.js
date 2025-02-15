const puppeteer = require('puppeteer-extra');
const { delay, readCSV, writeCSV, goto,init ,logger, appendCSV} = require("../utils");
const moment = require('moment');

const inputFile = '../temp/city.csv';
const outputFile = '../temp/zenden.address.csv';
const domain = 'zenden.ru';

(async () => {
    try {
        logger(domain, `Запуск парсинга Zenden`);
        const cities = await readCSV(inputFile, domain);
        const browser = await puppeteer.launch(await init());
        const page = await browser.newPage();

        if (!await goto(page, 'https://zenden.ru/shops', '.shops-standalone__group-item', 'domcontentloaded', domain)) {
            return;
        }

        let results = [];
        for (const row of cities) {
            logger(domain, `Обрабатываем город: ${row.city}`);
            await extractShops(page, row.city);
        }

        writeCSV(outputFile, results, domain);
        await browser.close();
        logger(domain, `✅ Парсинг завершён. Данные сохранены в ${outputFile}`);
    } catch (err) {
        logger(domain, `Критическая ошибка: ${err}`);
    }
})();

async function extractShops(page, city) {
    try {
        logger(domain, `Начинаем сбор данных для города: ${city}`);

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
            logger(domain, `Магазины в городе ${city} не найдены.`);
            return results;
        }

        logger(domain, `Найдено ${shopCards.length} магазинов в городе ${city}.`);

        for (const shopCard of shopCards) {
            const addressLines = await shopCard.$$eval('.shop-card__address .shop-card__line', nodes => nodes.map(n => n.textContent.trim()));
            if (addressLines.length > 1) {
                const mall = /ТЦ|ТРЦ|СТЦ/.test(addressLines[0]) ? /,/.test(addressLines[0]) ? addressLines[0].match(/^(.*),/)[1] : addressLines[0] : '';
                const address = addressLines[1];

                const data = {
                    "Регион": city,
                    "Торговый центр": mall,
                    "Адрес": address,
                    "Формат":"",
                    "Дата сбора": moment().format('DD.MM.YYYY')
                };

                appendCSV(outputFile, data, domain);
                logger(domain, ` Собран магазин: ${JSON.stringify(data)}`);
            }
        }

        return results;
    } catch (err) {
        logger(domain, `Ошибка при парсинге города ${city}: ${err}`);
        return [];
    }
}
