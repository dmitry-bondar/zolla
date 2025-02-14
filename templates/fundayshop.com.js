const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require("../logger");
const { delay, readCSV, writeCSV, goto, setCookies,init } = require("../utils");
const moment = require('moment');

puppeteer.use(StealthPlugin());

const inputFile = '../temp/city.csv';
const outputFile = '../temp/fundayshop.address.csv';

(async () => {
    try {
        logger(`Запуск парсинга FundayShop`);
        const cities = await readCSV(inputFile);
        const browser = await puppeteer.launch(await init());
        const page = await browser.newPage();

        await setCookies(page, cookies);

        if (!await goto(page, 'https://fundayshop.com/stores', '.stores .container .title span', 'networkidle2')) {
            return;
        }

        let results = [];
        for (const row of cities) {
            results.push(...await extractShops(page, row.city));
        }

        writeCSV(outputFile, results);
        await browser.close();
        logger(`Парсинг завершен.`);
    } catch (err) {
        logger(`Ошибка: ${err}`);
    }
})();

const cookies = [
    { name: 'CITY_ID', value: '30640299', domain: 'fundayshop.com' },
    { name: 'isCookieUsageAgreed', value: '1', domain: 'fundayshop.com' }
];

async function extractShops(page, city) {
    try {
        logger(`Начинаем сбор данных для города: ${city}`);
        await page.click('.stores .container .title span');
        await delay(10000);

        await page.waitForSelector('#ui-input-label-mask-query');
        await page.type('#ui-input-label-mask-query', city, { delay: 700 });
        await delay(10000);

        await page.waitForSelector('.suggests span');
        await page.click('.suggests span');
        await delay(10000);

        let results = [];
        const shopCards = await page.$$('.address');

        for (const shopCard of shopCards) {
            const address = await page.evaluate(el => el.textContent.trim(), shopCard);
            const mallMatch = address.match(/(ТЦ|ТРЦ\s*".*?)"/);
            const mall = mallMatch ? mallMatch[1] : '';

            const data ={
                "Регион": city,
                "Торговый центр": mall,
                "Адрес": address,
                "Дата сбора": moment().format('DD.MM.YYYY'),
            }

            results.push(data);

            logger(`Собран магазин: ${JSON.stringify(data)}`);
        }

        return results;
    } catch (err) {
        logger(`Ошибка при парсинге города ${city}: ${err}`);
        return [];
    }
}
