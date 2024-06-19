'use strict';

const fs = require('fs');
const path = require('path');

const dtfOpt = {
    hourCycle: 'h24',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
}
const dtformat = new Intl.DateTimeFormat('en-US', dtfOpt);

/** function to check if output directory exists and creates it if needed.
 *  This function exits the program if directory cannot be created for whatever reason
 *
 *  @returns {string} name of output directory
 */
module.exports.createDir = function createDir(dir, exitOnError) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
            // console.debug(`Directory ${dir} created.`);
        }
    }
    catch (err) {
        console.log(err);
        if (exitOnError) process.exit(1)
    }
    return dir
};


/** function to work around limitations of fs.realrath().
 *  We cannot call fs.realpath as it checks if file exists and errors out if
 *  file is non-existent and not just giving back the absolute path this one would have
 *
 *  @param file name of file to check
 *  @return absolute file name, no normalization for '../' is done if file does not exist
 */
module.exports.realpathNonexistentFile = function realpathNonexistentFile(file) {
    if (fs.existsSync(file)) {
        return fs.realpathSync(file);
    }
    // check for linux/macOS and windows, urls
    else if (file.startsWith('/') || file.match(/^[a-zA-Z]+:\\/)) {
        // absolute - return as is (no '../' normalization here
        return file;
    }
    else {
        return process.cwd() + path.sep + file;
    }
};

module.exports.logInfo = function logInfo(msg) {
    const dt = new Date();
    console.info(`${dtformat.format(dt)} - ${msg}` )
};

module.exports.logErr = function logErr(err) {
    const dt = new Date();
    console.error(`${dtformat.format(dt)} - ERROR ${err.msg}` );
    console.error(err)
};


module.exports.sleep = function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};


