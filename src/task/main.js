import * as cheerio from 'cheerio';
import PCR from 'puppeteer-chromium-resolver';
import path from 'path';
import { KoiiStorageClient } from '@_koii/storage-task-sdk';
import { namespaceWrapper } from '@_koii/namespace-wrapper';
import fs from 'fs';

let browser;
let page;
let allGamesData = []; // This will hold the accumulated game data
let basePath = '';
let filename = `dataList.json`;

async function setupSession() {
  try {
    const options = {};
    const userDataDir = path.join('koii/puppeteer_cache_ign');
    const stats = await PCR(options);
    console.log(
      '*****************************************CALLED PURCHROMIUM RESOLVER*****************************************',
    );

    browser = await stats.puppeteer.launch({
      executablePath: stats.executablePath,
      userDataDir: userDataDir,
      headless: true,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    console.log('Step: Open IGN page');
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );
    await page.setViewport({ width: 1920, height: 3080 });

    // Go to the IGN page
    await page.goto(
      'https://www.ign.com/faceoffs/whats-your-game-of-the-year-2024-so-far/results/community',
      {
        waitUntil: 'networkidle2',
      },
    );
  } catch (e) {
    console.log('Error setting up session', e);
  }
}

async function refreshPageAndCollectData() {
  try {
    console.log('Refreshing page...');
    await page.reload({ waitUntil: 'networkidle2' }); // Reload the current page

    // Extract HTML content from the page
    const content = await page.content();
    const $ = cheerio.load(content);

    // Prepare a new object to store games data for this timestamp
    const gamesAtCurrentTime = {};
    const currentTimestamp = new Date().toISOString(); // Get the current timestamp in UTC

    $('.faceoff-result-card').each((index, element) => {
      // Extract game name
      const game_name = $(element).find('h3.title3').text().trim();

      // Extract number of duels
      const duels = $(element)
        .find('.statistics')
        .first()
        .find('h3.title5')
        .text()
        .trim();

      // Extract won rate
      const wonRate = $(element)
        .find('.statistics')
        .eq(1)
        .find('h3.title5')
        .text()
        .trim();

      // Store game data under game name
      gamesAtCurrentTime[game_name] = {
        duels: parseInt(duels.replace(/\D/g, '')), // Parse to number by removing non-numeric characters
        wonRate: parseFloat(wonRate.replace('%', '').trim()), // Parse the percentage
      };
    });

    // Return the object with the timestamp as key and the games data as value
    return {
      [currentTimestamp]: gamesAtCurrentTime,
    };
  } catch (e) {
    console.log('Error refreshing page and collecting data', e);
    return null;
  }
}

// Function to refresh the page every minute and accumulate data
async function startRefreshing() {
  // Setup the session and open the page initially
  await setupSession();

  for (let i = 0; i < 10; i++) {
    let gamesDataAtTimestamp = await refreshPageAndCollectData();

    if (gamesDataAtTimestamp) {
      allGamesData.push(gamesDataAtTimestamp);
      //   console.log('Games Data at timestamp:', gamesDataAtTimestamp);
      //   console.log('All Games Data:', allGamesData);
    }
    console.log('Waiting for 10 seconds before refreshing the page...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait for 30 seconds before refreshing the page
  }
  console.log('All Games Data:', allGamesData);
}

async function storeData() {
  try {
    basePath = await namespaceWrapper.getBasePath();
    fs.writeFileSync(`${basePath}/${path}`, JSON.stringify(data));
    const client = new KoiiStorageClient(undefined, undefined, false);
    const userStaking = await namespaceWrapper.getSubmitterAccount();
    console.log(`Uploading ${basePath}/${filename}`);
    const fileUploadResponse = await client.uploadFile(
      `${basePath}/${path}`,
      userStaking,
    );
    console.log(`Uploaded ${basePath}/${path}`);
    const cid = fileUploadResponse.cid;
    return cid;
  } catch (err) {
    console.log(err);
  }
}

export async function main(round) {
  await startRefreshing();
  await browser.close();
  console.log('Task completed');
  const cid = await storeData();
  console.log('CID:', cid);
  return cid;
}
