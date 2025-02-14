const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
 const { delay, readCSV, writeCSV, goto, setCookies,init,logger, appendCSV} = require("../utils");
const moment = require('moment');
const domain = 'fundayshop.com';
puppeteer.use(StealthPlugin());

const inputFile = '../temp/city.csv';
const outputFile = '../temp/fundayshop.address.csv';

(async () => {
    try {
        logger(domain, `Запуск парсинга FundayShop`);
        const cities = await readCSV(inputFile, domain);
        const browser = await puppeteer.launch(await init());
        const page = await browser.newPage();

        await setCookies(page, cookies, domain);

        if (!await goto(page, 'https://fundayshop.com/stores', '.stores .container .title span', 'networkidle2', domain)) {
            return;
        }

        for (const row of cities) {
            await extractShops(page, row.city)
        }

        await browser.close();
        logger(domain, `Парсинг завершен.`);
    } catch (err) {
        logger(domain, `Ошибка: ${err}`);
    }
})();

const cookies = [
    { name: 'CITY_ID', value: '30640299', domain: 'fundayshop.com' },
    { name: 'isCookieUsageAgreed', value: '1', domain: 'fundayshop.com' }
];

async function extractShops(page, city) {
    try {
        logger(domain, `Начинаем сбор данных для города: ${city}`);
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
                "Дата сбора": moment().format('DD.MM.YYYY')
            }

            appendCSV(outputFile, data, domain);

            logger(domain, `Собран магазин: ${JSON.stringify(data)}`);
        }

        return results;
    } catch (err) {
        logger(domain, `Ошибка при парсинге города ${city}: ${err}`);
        return [];
    }
}
