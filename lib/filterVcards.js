'use strict';

/** program to read a directory with vcard files (e.g. created by vdirsyncer),
 *  filter them and create a new vcard file containing all contacts in a format
 *  understood by Gigaset DECT stations. This vcard file can later imported
 *  via web-ui of the DECT station.
 */

const fs = require('fs');
const path = require('path');
const deepEqual = require('deeper');
const vCard = require('vcf');

process.chdir(path.join(__dirname, '..'));
const config = require('config');
const helper = require('./helper');

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

const sourceDir = config.get('local.vcfDir');
const lineBreakRE = /\n(?<!\r)/g;


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
    console.info(`Found ${filterList.length} out of ${uidMemberList.length} vCards`);
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
                outpathputCard.addProperty(new vCard.Property(VCARD_PHONE, work[0].valueOf(), {type: [VCARD_TYPE_WORK]}));
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


function readVCardFromFile(file) {
    // Do whatever you want to do with the file
    console.debug('checking file - ' + file);
    if (file.endsWith('.vcf')) {
        const data = fs.readFileSync(path.join(sourceDir, file), {encoding: 'utf-8'});
        //console.trace('received data from file - ' + file + ': ' + data);
        const dataRN = data.replace(lineBreakRE, '\r\n');
        console.debug('parsing file as vCard - ' + file);
        const card = new vCard().parse(dataRN);
        console.debug('got vCard data from file - ' + file + ': ' + card.get(VCARD_FULLNAME).valueOf());
        return card;
    } else {
        console.debug(`ignore file ${file} based on file extension`);
        return null;
    }
}


function main() {
    console.info(`Start scanning dir ${sourceDir} for vCard files`);
    fs.readdir(sourceDir, function (errList, files) {
        if (errList) {
            return console.log(`Unable to scan directory: ${errList}`);
        }
        console.info(`Found ${files.length} files`);
        const allVCards = files.map(readVCardFromFile).filter((c) => { return c !== null });

        // now filter vCards based on explicit contact names or distribution list
        let filteredVCards;
        if (config.get('syncDistributionList')) {
            filteredVCards = filterByDistributionList(allVCards, config.get('syncDistributionList'));
        }
        else {
            filteredVCards = filterByFullName(allVCards, config.get('syncContacts'));
        }

        // now write output file from filtered contact list
        helper.createDir(path.dirname(config.get('destination.vCardFile')), true);

        // stringify all filtered vCards and write them into one file
        const outFile = config.get('destination.vCardFile');
        const vCardString = filteredVCards.map(stringifyVCardV21);
        fs.writeFile(outFile, vCardString.join('\r\n\r\n'), function (err) {
            if (err) return console.log(err);
            console.log(`VCF output data written to ${outFile}`);
        });
    });
}


// ==== start app
main();