'use strict';

/** program to write a vdirsyncer config file from json config files
 *
 *  This is a helper app for vdirsyncer (https://github.com/pimutils/vdirsyncer)
 */

const fs = require('fs');
const path = require('path');
const helper = require('./helper');

process.chdir(path.join(__dirname, '..'));
const config = require('config');

const configFile = config.get('local.vsyncConfig');
const statusDir = config.get('local.vsyncStatusDir');


/** check if a directory exists, is a directory and deletes it than.
 *  Program is exited on error, no further handling done.
 *
 * @param dir name of directory to delete
 * @returns {Promise<void>}
 */
async function deleteDirIfExists(dir) {
    if (fs.existsSync(dir)) {
        await fs.promises.rmdir(dir).catch((err) => {
            // not a directory or no access rights - exit here
            helper.logErr(err);
            process.exit(1);
        })
    }
}


/** create a new vdirsyncer config file at the given location from data
 *  of this apps json config files.
 *
 *  This is needed to be in sync with all other tools from this project to
 *  reference tha same data everywhere.
 *
 *  @param outFile name of config file to write
 */
function createConfigfile(outFile) {
    const writer = fs.createWriteStream(outFile, {
        encoding: 'utf8', autoClose: true, mode: 0o600
    });
    writer.write('[general]\n');
    writer.write(`status_path = "${helper.realpathNonexistentFile(statusDir)}"\n`);

    writer.write('\n[pair dect-sync]\n');
    writer.write('a = "carddav_server"\n');
    writer.write('b = "contacts_local"\n');
    writer.write('collections = ["from a"]\n');

    writer.write('\n[storage contacts_local]\n');
    writer.write('type = "filesystem"\n');
    writer.write('fileext = ".vcf"\n');
    writer.write(`path = "${helper.realpathNonexistentFile(config.get('local.vcfDir'))}"\n`);

    writer.write('\n[storage carddav_server]\n');
    writer.write('type = "carddav"\n');
    writer.write(`url = "${config.get('cardDav.url')}"\n`);
    writer.write(`username = "${config.get('cardDav.username')}"\n`);
    writer.end(`password = "${config.get('cardDav.password')}"\n`);
    writer.on('finish', () => {
        console.log(`${outFile}`);
    });
}


/** read entire config file into a string
 *
 *  @param file name of vdirsyncer config file
 *  @returns {Promise<Buffer|string>} resolves to content of config file
 */
async function readConfigFile(file) {
    return await fs.promises.readFile(file, {encoding: 'utf8'});
}


/** check string with config data if some important params are the same (old config
 *  and new config to write will not differ there). This is important to check
 *  if current vdirsyncer state directory must be deleted to reflect these changes.
 *
 *  @param cfg String with content of old config file
 *  @returns {boolean} true if changes need invalidation of vdirsyncer status directory
 */
function configHasChanged(cfg) {
    // only check important values related to vdirsyncer status files
    const localOutDir = `\npath = "${helper.realpathNonexistentFile(config.get('local.vcfDir'))}"\n`;
    const urlLine = `\nurl = "${config.get('cardDav.url')}"\n`;
    const userLine = `\nusername = "${config.get('cardDav.username')}"\n`;
    const pwdLine = `\npassword = "${config.get('cardDav.password')}"\n`;

    cfg = cfg.replace(/\r\n/g, '\n');
    let configChanged = !cfg.includes(localOutDir);
    configChanged = configChanged || !cfg.includes(urlLine);
    configChanged = configChanged || !cfg.includes(userLine);
    configChanged = configChanged || !cfg.includes(pwdLine);
    return configChanged;
}


/** main function to call for app
 */
async function main() {
    // check if old config exists
    // this must be read and remote-url/user/pass compared to the current one.
    // if filed has changed the vsnyc status dir must be deleted too
    if (fs.existsSync(configFile)) {
        const cfg = await readConfigFile(configFile);
        if (configHasChanged(cfg)) {
            await deleteDirIfExists(statusDir);
        }
        // write nonetheless to reflect possible minor changes
        createConfigfile(configFile);
    } else {
        // easy way - create new one
        helper.createDir(path.dirname(configFile), true);
        await deleteDirIfExists(statusDir);
        createConfigfile(configFile);
    }
}

// start program
main();
