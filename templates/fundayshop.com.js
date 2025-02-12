const fs = require('fs');
const csv = require('csv-parser');
const puppeteer = require('puppeteer-extra');
const logger = require("../logger");
const moment = require('moment');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());


const inputFile = '../temp/city.csv';
const outputFile = '../temp/fundayshop.address.csv';
const MAX_RELOADS = 15;
let results = [];
let success = false;
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    try {
        const stream = fs.createReadStream(inputFile).pipe(csv());
        let page = await goto()
        for await (const row of stream) {
            const city = row.city;
            if (!success) {
                logger(`Не удалось загрузить страницу после ${MAX_RELOADS} попыток.`);
                continue;
            }
            else{
                await extract(page,city)
            }
        }
        fs.writeFileSync(outputFile, 'Регион,Торговый центр,Адрес,Дата сбора\n' + results.map(r => `${r["Регион"]},${r["Торговый центр"]},${r["Адрес"]},${r["Дата сбора"]}`).join('\n'));
        logger('Готово! Данные сохранены в', outputFile);
    } catch (err) {
        logger('Ошибка обработки файла CSV:', err);
    }
})();

async function extract(page,city) {
    try {
        logger("Собраем город " + city)
        await page.click('.stores .container .title span');
        await delay(10000); // Задержка для более плавной загрузки

        await page.waitForSelector('#ui-input-label-mask-query');
        await page.type('#ui-input-label-mask-query', city, {delay: 700});
        await delay(10000);

        await page.waitForSelector('.suggests span'); // Дождемся, пока появится список предложений
        await page.click('.suggests span');
        await delay(10000); // Подождем после клика

        let address;
        try {
            const addressElement = await page.$('.address');
            if (addressElement) {
                address = await page.$eval('.address', el => el.textContent.trim());
                const mall = /ТЦ/.test(address)
                const data = {
                    "Регион":city,
                    "Торговый центр": mall  ? address.match(/ТЦ.*\"(.*)\"/)?.[1] : '',
                    "Адрес": address,
                    "Дата сбора": moment().format('YYYY-MM-DDTHH:mm:ss')
                }
                results.push(data);
                logger("Собрали " + JSON.stringify(data))
            } else {
                logger(`Адрес для ${city} не найден на странице.`);
            }
        } catch (err) {
            logger(`Ошибка при парсинге адреса для ${city}:`, err);
            await extract(page,city);
        }
    } catch (e) {
        logger(e)
        await goto()
        await extract(page,city);
    }
}

async function goto() {
    let reloads = 0;
    let options = await init();
    let browser = await puppeteer.launch(options);
    let page = await browser.newPage();
    await page.setCookie(
        {name: 'CITY_ID', value: '30640299', domain: 'fundayshop.com'},
        {name: 'isCookieUsageAgreed', value: '1', domain: 'fundayshop.com'}
    );
    while (reloads < MAX_RELOADS && !success) {
        try {
            await page.goto('https://fundayshop.com/stores', {waitUntil: 'networkidle2', timeout: 30000});
            await page.waitForSelector('.stores .container .title span'); // Дождемся, пока загрузится основной контейнер
            success = true;
            await delay(10000);
            return page
        } catch (err) {
            logger(`Не удалось загрузить страницу, перезагрузка браузера (${reloads + 1}/${MAX_RELOADS})`);
            await browser.close();
            await goto();
            reloads++;
        }
    }
}

async function getProxies() {
    const proxies = [
        `http://185.68.152.9:${(25000 + Math.floor(Math.random() * 4999))}`,
        // `http://95.64.219.194:${(10001 + Math.floor(Math.random() * 68))}`,
        // `http://95.64.219.194:${(3101 + Math.floor(Math.random() * 24))}`,
        // `http://95.64.164.230:${(3201 + Math.floor(Math.random() * 24))}`,
        // `http://95.64.164.230:${(3301 + Math.floor(Math.random() * 24))}`,
        // `http://95.64.164.230:${(3404 + Math.floor(Math.random() * 24))}`,
        // `http://95.64.164.230:${(4000 + Math.floor(Math.random() * 7))}`,

    ];
    return proxies[Math.floor(Math.random() * proxies.length)];
}

async function init() {
    const proxy = await getProxies();
    logger('Proxy: ' + proxy)
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
        // defaultViewport: null,
    };
}
