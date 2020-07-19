'use strict';

/** program to upload a selected vcard file to a Gigaset DECT station as personal address books for
 * mobile handsets.
 */

(function main() {
    const gigaset = require('./gigaset/upload');
    gigaset.upload()
})();