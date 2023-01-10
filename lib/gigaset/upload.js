'use strict';

/** program to upload a selected vcard to a Gigaset DECT station as personal address books for
 * mobile handsets.
 *
 * Upload is done via headless chrome instance controlling the management web-ui.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('config');
const helper = require('../helper');
const debug = require('debug')('  PAGE LOG');

let browser;        // browser object
let handsets;       // array of arrays from gigaset page with all handsets configured
let isLoggedIn = false;     // flag if login succeeded. need to log out on exit!


/** event handler for login dialog - needed if pin is wrong or someone else already
 *  logged into the system from another client.
 *  If dialog is shown some got wrong on login and we exit our program.
 *
 * @param dialog ref to js dialog window
 * @returns {Promise<void>}
 */
async function loginDialogHandler(dialog) {
    console.log('LOGIN DIALOG MSG:', dialog.message());
    await dialog.dismiss();
    await browser.close();
    process.exit(3);
}


/** event handler for upload dialog - the dialog is shown at the end either saiing everythen
 *  was send or an error occured, Just log message to console and close dialog.
 *
 * @param dialog ref to js dialog window
 * @returns {Promise<void>}
 */
async function uploadDialogHandler(dialog) {
    console.log('PHONE DIALOG MSG:', dialog.message());
    await dialog.dismiss();
}


/** event handler for delete dialog - after pressing delete button system asks if we really want
 *  to delete current phone book and another popup may be shown at the end after deletion.
 *
 * @param dialog ref to js dialog window
 * @returns {Promise<void>}
 */
async function deleteDialogHandler(dialog) {
    console.log('DELETE DIALOG MSG:', dialog.message());
    await dialog.accept();
}


async function login(page) {
    helper.logInfo('Log into gigaset DECT management page');
    await page.goto(config.get('destination.gigaset.host') + config.get('destination.gigaset.loginPage'));
    // changing language triggers page reload
    //await page.focus('[name="language"]');
    //await page.keyboard.type('d');
    await page.focus('#password');
    await page.keyboard.type(config.get('destination.gigaset.pin'));

    // dialog is shown on login errors - register here to close popup and not wait endless for page transition
    page.on('dialog', loginDialogHandler);
    await Promise.all([
        page.waitForNavigation(),
        page.click('a.buttonLink100')
    ]);

    // wait for possible dialog popup where browser closes
    await helper.sleep(2000);
    page.off('dialog', loginDialogHandler);
    return browser.isConnected();
}


async function selectHandset(page, handset) {
    await page.waitFor(1000);       // needed for slow web page / js geraffel
    await page.waitForSelector('a.buttonLink100');
    helper.logInfo(`Selecting handset "${handset.name}" (${handset.model} - FW ${handset.fw})`);
    await page.click('#hs_phonebook_transf_radio_' + handset.idx);
}


async function deletePhonebook(page) {
    helper.logInfo('Purge current phone book on handset');
    // dialog popup is given when finished
    page.on('dialog', deleteDialogHandler);
    await Promise.all([
        page.waitForNavigation(),
        page.evaluate(() => { start_tdt_delete() })
    ]);
    await page.waitFor(2000);

    // now loop as long as remote url is "/status.html"
    while (page.url().endsWith('/status.html')) {
        await helper.sleep(1000);
    }
    page.off('dialog', deleteDialogHandler);
    await page.waitForSelector('a.buttonLink100');
}


async function uploadPhonebook(page) {
    helper.logInfo('Upload new phone book');
    const inputUploadHandle = await page.$('#tdt_file');
    const fileToUpload = path.join(config.get('destination.vCardFile'));
    await inputUploadHandle.uploadFile(fileToUpload);

    // dialog popup is given when finished
    page.on('dialog', uploadDialogHandler);
    await page.waitForSelector('a.buttonLink100');  // all buttons, just check if one is available after upload
    await Promise.all([
        page.waitForNavigation(),
        page.evaluate(() => { start_tdt_upload() })
    ]);

    // now loop as long as remote url is "/status.html"
    while (page.url().endsWith('/status.html')) {
        await helper.sleep(2000);
    }
    page.off('dialog', uploadDialogHandler);
}


module.exports.upload = async function upload() {
    const launchParam = {};
    if (config.get('chrome.executable')) launchParam.executablePath = config.get('chrome.executable');
    if (config.get('chrome.debug')) launchParam.headless = false;
    browser = await puppeteer.launch(launchParam);
    let page;

    try {
        page = await browser.newPage();
        await page.setViewport({width: 950, height: 768});
        page.on('console', msg => debug(msg.text()));

        isLoggedIn = await login(page);
        if (!isLoggedIn) return;

        helper.logInfo('Navigate to local phone book management page');
        await page.goto(config.get('destination.gigaset.host') + config.get('destination.gigaset.phonebookPage'));
        handsets = await page.evaluate(() => {
            return handsets;
        });
        helper.logInfo(`Found ${handsets.length} handsets configured: ` + handsets.map((h) => h[0]).join());

        // Buttons on phone book page have no ids or similar unique identifiers...
        // must call javascript functions directly
        //  upload pc -> phone:  start_tdt_upload()
        //  download phone -> pc:  start_tdt_download()
        //  delete from phone:  start_tdt_delete()
        //
        // afterwards pages reloads inside loop until finished

        let confHandsets = config.get('destination.gigaset.handsets');
        // if its string (fallback for setting via environment variable) convert to array
        if (typeof confHandsets === 'string') {
            if (confHandsets.startsWith('[') && confHandsets.endsWith(']')) {
                confHandsets = JSON.parse(confHandsets);
            }
            else {
                confHandsets = [confHandsets];
            }
        }

        // loop over all handsets and select each one that is configured in config, filter invalid names
        let useHandsets = handsets.map((h, index) => { return {name: h[0], idx: index, model: h[10], fw: h[11]} });
        if (confHandsets.length !== 1 || confHandsets[0] !== 'ALL') {
            useHandsets = useHandsets.filter((h) => confHandsets.includes(h.name))
        }

        helper.logInfo("Now starting phonebook update for handsets: " + useHandsets.map((h) => h.name).join());
        for (let idx = 0; idx < useHandsets.length; ++idx) {
            let handset = useHandsets[idx];
            if (config.get('destination.gigaset.deleteBeforeUpload')) {
                await selectHandset(page, handset);
                await deletePhonebook(page);
            }
            // need to reselect here as delete triggers a reload
            await selectHandset(page, handset);
            await uploadPhonebook(page);
        }
    }
    catch (e) {
        helper.logErr(e);
    }
    finally {
        if (page && isLoggedIn) {
            await page.click('#logouttoptext');
            await helper.sleep(500);
        }
        await browser.close();
    }
}

