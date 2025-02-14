const puppeteer = require('puppeteer-extra');
const logger = require("../logger");
const {delay, readCSV, writeCSV, goto, init, setCookies} = require("../utils");
const moment = require('moment');

const inputFile = '../temp/city.csv';
const outputFile = '../temp/acoolakids.address.csv';
const blacklist = ['subscribe'];

(async () => {
    try {
        logger(`Запуск парсинга acoolakids`);
        const cities = await readCSV(inputFile);
        const browser = await puppeteer.launch(await init());
        const page = await browser.newPage();

        await setCookies(page, cookies);

        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const requestUrl = request.url().toLowerCase();
            if (blacklist.some(blocked => requestUrl.includes(blocked))) {
                request.abort();
            } else {
                request.continue();
            }
        });

        if (!await goto(page, 'https://acoolakids.ru/shops', '.city-choice-popup__confirm  .city-choice-popup__button_confirm', 'domcontentloaded')) {
            return;
        }else{
            await page.click('.city-choice-popup__confirm  .city-choice-popup__button_confirm');
            await delay(5000);
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

const cookies = [
    { name: 'cookiesAccepted', value: 'true', domain: 'acoolakids.ru' },
    { name: 'subscriptionCallPopupClosed', value: 'true', domain: 'acoolakids.ru' },
    // { name: 'BITRIX_SM_CURRENT_LOCATION', value: '0000133095', domain: 'acoolakids.ru' }
];

async function extractShops(page, city) {
    try {
        logger(`Начинаем сбор данных для города: ${city}`);

        await page.click('.header__location-wrap');
        await delay(5000);

        await page.waitForSelector('.search-input__field-wrapper #city-choice-search');
        await page.type('.search-input__field-wrapper #city-choice-search', city, {delay: 500});
        await delay(5000);

        await page.waitForSelector('.search-input__result-item');
        await page.click('.search-input__result-item');
        await delay(10000);

        let results = [];
        const shopCards = await page.$$('.search-shop__wrapper .shop-address');

        if (shopCards.length === 0) {
            logger(`Магазины в городе ${city} не найдены.`);
            return results;
        }

        logger(`Найдено ${shopCards.length} магазинов в городе ${city}.`);

        for (const shopCard of shopCards) {
            try {
                // Получаем массив строк, берем первый элемент (если есть) и очищаем от пробелов
                const address = await shopCard.$eval('.shop-address__label', el => el.textContent.trim())
                    .catch(() => "Адрес не найден");

                // Получаем текст торгового центра
                let mallText = await shopCard.$eval('.shop-address__title-wrapper', el => el.textContent.trim())
                    .catch(() => "");
                const mall = /ТЦ|ТРЦ|СТЦ/.test(mallText) ? /,/.test(mallText) ? mallText.match(/^(.*),/)[1] : mallText : '';

                const data = {
                    "Регион": city,
                    "Торговый центр": mall,
                    "Адрес": address,
                    "Дата сбора": moment().format('DD.MM.YYYY'),
                };

                results.push(data);
                logger(`Собран магазин: ${JSON.stringify(data)}`);
            } catch (err) {
                logger(`Ошибка при обработке карточки: ${err}`);
            }
        }

        return results;
    } catch (err) {
        logger(`Ошибка при парсинге города ${city}: ${err}`);
        return [];
    }
}
