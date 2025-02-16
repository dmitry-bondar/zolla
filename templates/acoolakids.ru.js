const puppeteer = require('puppeteer-extra');
const { delay, readCSV, appendCSV, goto, init, setCookies, logger } = require("../utils");
const moment = require('moment');

const inputFile = '../temp/city.csv';
const outputFile = '../temp/acoolakids.address.csv';
const blacklist = ['subscribe'];
const domain = 'acoolakids.ru';

(async () => {
    try {
        logger(domain, `Запуск парсинга acoolakids`);
        const cities = await readCSV(inputFile, domain); // Передаем domain в readCSV
        const browser = await puppeteer.launch(await init());
        const page = await browser.newPage();

        await setCookies(page, cookies, domain); // Передаем domain в setCookies

        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const requestUrl = request.url().toLowerCase();
            if (blacklist.some(blocked => requestUrl.includes(blocked))) {
                request.abort();
            } else {
                request.continue();
            }
        });

        if (!await goto(page, 'https://acoolakids.ru/shops', '.city-choice-popup__confirm  .city-choice-popup__button_confirm', 'domcontentloaded', domain)) {
            return;
        } else {
            await page.click('.city-choice-popup__confirm  .city-choice-popup__button_confirm');
            await delay(5000);
        }

        for (const row of cities) {
            logger(domain, `Обрабатываем город: ${row.city}`);
            await extractShops(page, row.city);
        }
        await browser.close();
        logger(domain, `✅ Парсинг завершён. Данные сохранены в ${outputFile}`);
    } catch (err) {
        logger(domain, `Критическая ошибка: ${err}`);
    }
})();

const cookies = [
    { name: 'cookiesAccepted', value: 'true', domain: 'acoolakids.ru' },
    { name: 'subscriptionCallPopupClosed', value: 'true', domain: 'acoolakids.ru' },
    // { name: 'BITRIX_SM_CURRENT_LOCATION', value: '0000133095', domain: 'acoolakids.ru' }
];

async function extractShops(page, city) {
    try {
        logger(domain, `Начинаем сбор данных для города: ${city}`);

        await page.click('.header__location-wrap');
        await delay(5000);

        await page.waitForSelector('.search-input__field-wrapper #city-choice-search');
        await page.type('.search-input__field-wrapper #city-choice-search', city, { delay: 500 });
        await delay(5000);

        await page.waitForSelector('.search-input__result-item');
        await page.click('.search-input__result-item');
        await delay(10000);

        let results = [];
        const shopCards = await page.$$('.search-shop__wrapper .shop-address');

        if (shopCards.length === 0) {
            logger(domain, `Магазины в городе ${city} не найдены.`);
            return results;
        }

        logger(domain, `Найдено ${shopCards.length} магазинов в городе ${city}.`);

        for (const shopCard of shopCards) {
            try {
                const address = await shopCard.$eval('.shop-address__label', el => el.textContent.trim())
                    .catch(() => "Адрес не найден");

                let mallText = await shopCard.$eval('.shop-address__title-wrapper', el => el.textContent.trim())
                    .catch(() => "");
                const mall = /ТЦ|ТРЦ|СТЦ/.test(mallText) ? /,/.test(mallText) ? mallText.match(/^(.*),/)[1] : mallText : '';

                const data = {
                    "Регион": city,
                    "Торговый центр": mall,
                    "Адрес": address,
                    "Формат":"",
                    "Дата сбора": moment().format('DD.MM.YYYY')
                };

                appendCSV(outputFile, data, domain);
                logger(domain, `Собран магазин: ${JSON.stringify(data)}`);
            } catch (err) {
                logger(domain, `Ошибка при обработке карточки: ${err}`);
                await page.reload()
                        await delay(10000)
                        await extractShops(page, city);
            }
        }

        return results;
    } catch (err) {
        logger(domain, `Ошибка при парсинге города ${city}: ${err}`);
        await page.reload()
        await delay(10000)
        await extractShops(page, city);
        return [];
    }
}