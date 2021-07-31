'use strict';

/** program to upload a selected vcard file to a Gigaset DECT station as personal address books for
 * mobile handsets.
 */

const path = require('path');
process.chdir(path.join(__dirname, '..'));
const config = require('config');

(function main() {
    if (config.get('destination.gigaset.enabled')) {
        const gigaset = require('./gigaset/upload');
        gigaset.upload()
    }
})();