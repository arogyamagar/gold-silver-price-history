import fs from 'fs/promises';
import axios from 'axios';
import * as cheerio from 'cheerio';
import NepaliDate from 'nepali-datetime';

const JSON_FILE_PATH = 'products.json';
const TARGET_URL = 'https://www.sharesansar.com/bullion';

/**
 * Scrapes ShareSansar to fetch Fine Gold and Silver rates.
 */
async function scrapeBullionRates() {
    try {
        const { data: html } = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(html);
        const pageText = $('body').text();

        const fineGoldMatch = pageText.match(/(?:Fine|Hallmark)\s+Gold[^\d]*Rs\.?\s*([\d,]+)/i);
        const silverMatch = pageText.match(/Silver[^\d]*Rs\.?\s*([\d,]+)/i);

        const rates = {};

        if (fineGoldMatch) {
            rates.fineGold = parseInt(fineGoldMatch[1].replace(/,/g, ''), 10);
        }

        if (silverMatch) {
            rates.silver = parseInt(silverMatch[1].replace(/,/g, ''), 10);
        }

        return rates;
    } catch (error) {
        console.error('[-] Scraping error:', error.message);
        return null;
    }
}

/**
 * Gets AD and BS dates in YYYY-MM-DD format.
 */
function getFormattedDates() {
    const now = new Date();

    // Format AD
    const adYear = now.getFullYear();
    const adMonth = String(now.getMonth() + 1).padStart(2, '0');
    const adDay = String(now.getDate()).padStart(2, '0');
    const adDateStr = `${adYear}-${adMonth}-${adDay}`;

    // Format BS using nepali-datetime
    const nepaliDate = new NepaliDate();
    const bsDateStr = nepaliDate.format('YYYY-MM-DD');

    return { ad: adDateStr, bs: bsDateStr };
}

/**
 * Reads existing JSON array, updates/appends today's entry, and saves.
 */
async function updateJson() {
    console.log(`[${new Date().toISOString()}] Scraping bullion rates...`);
    const rates = await scrapeBullionRates();

    if (!rates || !rates.fineGold || !rates.silver) {
        console.error('[-] Failed to retrieve valid rates. Skipping JSON update.');
        return;
    }

    const { ad, bs } = getFormattedDates();

    const newEntry = {
        ad,
        bs,
        fineGold: rates.fineGold,
        silver: rates.silver,
    };

    let data = [];

    try {
        const fileContent = await fs.readFile(JSON_FILE_PATH, 'utf-8');
        data = JSON.parse(fileContent);
        if (!Array.isArray(data)) {
            data = [data];
        }
    } catch (err) {
        data = [];
    }

    const existingIndex = data.findIndex((entry) => entry.ad === newEntry.ad);
    if (existingIndex !== -1) {
        data[existingIndex] = newEntry;
    } else {
        data.push(newEntry);
    }

    await fs.writeFile(JSON_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');

    console.log('[+] JSON updated successfully:');
    console.log(JSON.stringify(newEntry, null, 2));
}

// Run script
updateJson();