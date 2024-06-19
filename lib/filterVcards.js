'use strict';

/** program to read a directory with vcard files (e.g. created by vdirsyncer),
 *  filter them and create a new vcard file containing all contacts in a format
 *  understood by Gigaset DECT stations. This vcard file can be imported
 *  via web-ui of the DECT station later.
 */
const path = require('path');
const { readdir, readFile, writeFile } = require('fs').promises;
const deepEqual = require('deeper');
const vCard = require('vcf');

process.chdir(path.join(__dirname, '..'));
const config = require('config');
const helper = require('./helper');
const debug = require('debug')('filterVcards');

const VCARD_VERSION = 'version';
const VCARD_UID = 'uid';
const VCARD_NAME = 'n';
const VCARD_ADRESSBOOK = 'xAddressbookserverKind';
const VCARD_ADRESSBOOK_MEMBER = 'xAddressbookserverMember';
const VCARD_FULLNAME = 'fn';
const VCARD_PHONE = 'tel';
const VCARD_TYPE_CELL = 'cell';
const VCARD_TYPE_FIXED = 'voice';
const VCARD_TYPE_HOME = 'home';
const VCARD_TYPE_WORK = 'work';

const sourceDir = config.get('local.vcfBaseDir');
const lineBreakRE = /\n(?<!\r)/g;


async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

/** function to filter list of vCards by its full name. All cards with a full name being part of the
 *  contacts list is returned.
 *
 * @param {vCard[]} list array with all vCards to filter upon
 * @param {string[]} contacts string array with all full names to search for in list
 * @returns {vCard[]} array with all vCards found in list
 */
function filterByFullName(list, contacts) {
    return list.filter((c) => { return contacts.includes(c.get(VCARD_FULLNAME).valueOf())});
}


/** function to filter list of vCards based upon a distribtion list vCard. The distribution lsit vCard must be part of
 *  the list with all vCards to filter upon.
 *  First the distribution list vCard is extracted and than all contacts referenced as members (xAddressbookserverMember)
 *  are searched inside the list.
 *
 * @param {vCard[]} list array with all vCards to filter upon
 * @param {string} distListName full name of a vCard of type 'xAddressbookserverKind' (distribution list)
 * @returns {vCard[]} array with all vCards found in list
 */
function filterByDistributionList(list, distListName) {
    let distList = list.find(
        (c) => { return (c.get(VCARD_FULLNAME).valueOf() === distListName && c.get(VCARD_ADRESSBOOK) != null) }
    );
    if (!distList) {
        helper.logErr({msg:`Distribution list "${distListName}" not found - Exit`});
        process.exit(1);
    }
    let uidMemberList = distList.get(VCARD_ADRESSBOOK_MEMBER).map(
        (p) => { return (p.valueOf().split(':')[2] || '') }
    );
    let filterList = list.filter((c) => {
        try {
            return uidMemberList.includes(c.get(VCARD_UID).valueOf())
        }
        catch (e) {         // no uid here
            return false
        }
    });
    helper.logInfo(`Found ${filterList.length} out of ${uidMemberList.length} vCards`);
    return filterList;
}


/** function to create a V2.1 vCard string from the given vCard. The stringified version of the VCard only contains
 *  Name, Fullname and Phone entries. Whenever a phone entry as multiple types (e.g. VOICE,HOME) its mapped to only one
 *  type (CALL, HOME, WORK). If an vCard has more than these three number types all additional ones are dropped and not
 *  stringified.
 *
 * @param {vCard} card The vCard to create a string from
 * @returns {String} version 2.1 vCard string with selected fields only
 */
function stringifyVCardV21(card) {
    let outputCard = new vCard();
    outputCard.setProperty(card.get(VCARD_VERSION));
    outputCard.setProperty(card.get(VCARD_NAME));
    outputCard.setProperty(card.get(VCARD_FULLNAME));

    let phones = card.get(VCARD_PHONE);
    if (phones) {
        // either list of phone numbers or a single phone property
        if (Array.isArray(phones)) {
            // prefer home cell before work cell
            // save cell phone number to not duplicate as work number
            let mobile = null;
            let mobiles = phones.filter((p) => { return p.is(VCARD_TYPE_CELL); });
            if (mobiles.length === 1) {
                mobile = mobiles[0];
            }
            else if (mobiles.length > 1) {
                let mobileFiltered = (mobiles.filter((p) => { return p.is(VCARD_TYPE_HOME) })) ?
                    mobiles.filter((p) => { return p.is(VCARD_TYPE_HOME) }) :
                    mobiles.filter((p) => { return p.is(VCARD_TYPE_WORK) });
                if (mobileFiltered.length > 0) {
                    mobile = mobileFiltered[0];

                }
            }
            if (mobile) {
                outputCard.addProperty(new vCard.Property(VCARD_PHONE, mobile.valueOf(), {type: [VCARD_TYPE_CELL]}));
            }

            // search for fixed & home as HOME phone
            let fixed = phones.filter(function (p) {
                return p.is(VCARD_TYPE_FIXED) && p.is(VCARD_TYPE_HOME);
            });
            if (fixed.length > 0) {
                outputCard.addProperty(new vCard.Property(VCARD_PHONE, fixed[0].valueOf(), {type: [VCARD_TYPE_HOME]}));
            }

            // find a work address, prefer fixed before mobile
            let work = phones.filter((p) => { return (p.is(VCARD_TYPE_WORK) && !deepEqual(p, mobile)) });
            if (work.length > 0) {
                outputCard.addProperty(new vCard.Property(VCARD_PHONE, work[0].valueOf(), {type: [VCARD_TYPE_WORK]}));
            }
        }
        else {
            // only one phone number, remove multi-types before adding
            let type = [];
            if (phones.is(VCARD_TYPE_CELL)) type.push(VCARD_TYPE_CELL);
            else if (phones.is(VCARD_TYPE_HOME)) type.push(VCARD_TYPE_HOME);
            else type.push(VCARD_TYPE_WORK);
            outputCard.addProperty(new vCard.Property(VCARD_PHONE, phones.valueOf(), {type: type}))
        }
    }
    return outputCard.toString('2.1', 'utf8');
}


async function readVCardFromFile(file) {
    // Do whatever you want to do with the file
    debug('checking file - %s', file);
    if (file.endsWith('.vcf')) {
        try {
            const data = await readFile(file, {encoding: 'utf-8'});
            // console.trace('received data from file - ' + file + ': ' + data);
            const dataRN = data.replace(lineBreakRE, '\r\n');
            debug('parsing file as vCard - %s', file);
            const card = new vCard().parse(dataRN);
            debug('got vCard data from file - %s: %s', file, card.get(VCARD_FULLNAME).valueOf());
            return card;
        }
        catch (errRead) {
            helper.logErr(errRead);
            return null;
        }
    } else {
        debug('ignore file %s based on file extension', file);
        return null;
    }
}


async function main() {
    helper.logInfo(`Start scanning dir ${sourceDir} for vCard files`);
    try {
        const files = await getFiles(sourceDir)
        helper.logInfo(`Found ${files.length} files`);

        const allVCards = (await Promise.all(files.map(readVCardFromFile))).filter((c) => {
            return c !== null
        });
        // now filter vCards based on explicit contact names or distribution list
        let filteredVCards;
        if (config.get('syncDistributionList')) {
            filteredVCards = filterByDistributionList(allVCards, config.get('syncDistributionList'));
        } else {
            filteredVCards = filterByFullName(allVCards, config.get('syncContacts'));
        }

        // write output file from filtered contact list
        // stringify all filtered vCards and write them into one file
        const outFile = config.get('destination.vCardFile');
        helper.createDir(path.dirname(outFile), true);
        const vCardStrings = filteredVCards.map(stringifyVCardV21);
        writeFile(outFile, vCardStrings.join('\r\n\r\n'), {encoding: 'utf8', mode: 0o600}).then(() => {
            helper.logInfo(`VCF output data written to ${outFile}`);
        }).catch((err) => {
            helper.logErr(err);
        });
    }
    catch (errList) {
        return helper.logErr({msg: `Unable to scan directory: ${errList}`});
    }
}


// ==== start app
main();
