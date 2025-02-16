const puppeteer = require('puppeteer-extra');
const { delay, readCSV, appendCSV, goto, init, setCookies, logger } = require("../utils");
const moment = require('moment');

const inputFile = '../temp/city.csv';
const outputFile = '../temp/shop.mango.address.csv';
const domain = 'shop.mango.com';

(async () => {
    try {
        logger(domain, `Запуск парсинга shop.mango`);
        const cities = await readCSV(inputFile, domain); // Передаем domain в readCSV
        const browser = await puppeteer.launch(await init());
        const page = await browser.newPage();

        if (!await goto(page, 'https://shop.mango.com/ru/ru/stores', '[aria-labelledby="cbanner-title"] [id="cookies.button.acceptAll"]', 'domcontentloaded', domain)) {
            return;
        } else {
            await page.click('[aria-labelledby="cbanner-title"] [id="cookies.button.acceptAll"]');
            await delay(3000);
            await page.click('#changeCountryAccept');
            await delay(3000);
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

        await page.waitForSelector('[aria-labelledby="search-title"]');

        await page.click('[aria-labelledby="search-title"]');
        await page.keyboard.press('Control');  // Для отмены автозаполнения
        await page.keyboard.down('Control');
        await page.keyboard.press('A');  // Выделить весь текст
        await page.keyboard.press('Backspace');  // Удалить выделенное
        await page.keyboard.up('Control');

        await page.type('[aria-labelledby="search-title"]', city, { delay: 500 });
        await delay(2000);

        await page.click('[class*="SearchLocationForm_button"]');
        await delay(7000);

        const shopCards = await page.$$('[class*="StoreList_list"] [class*="ListExpandible_container"]');

        if (shopCards.length === 0) {
            logger(domain, `Магазины в городе ${city} не найдены.`);
            return
        }

        logger(domain, `Найдено ${shopCards.length} магазинов в городе ${city}.`);

        for (const shopCard of shopCards) {
            const addressLines = await shopCard.$$eval('[class*="StoreList_list"] [class*="ListExpandible_container"] [class*="StoreAddress_address"] p', nodes => nodes.map(n => n.textContent.trim()));
            if (addressLines.length > 1) {
                const data = {
                    "Регион": city,
                    "Торговый центр": addressLines[0],
                    "Адрес": addressLines[1] + ' ' + addressLines[2],
                    "Формат": addressLines[3],
                    "Дата сбора": moment().format('DD.MM.YYYY')
                };

                appendCSV(outputFile, data, domain);
                logger(domain, ` Собран магазин: ${JSON.stringify(data)}`);
            }
        }
    } catch (err) {
        logger(domain, `Ошибка при парсинге города ${city}: ${err}`);

        await page.reload()
                await delay(10000)
                await extractShops(page, city);
        return [];
    }
}