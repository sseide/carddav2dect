#!/usr/bin/env bash

exitEcho() {
    echo $2
    exit $1
}

log() {
    echo "$(date +'%F %H:%M:%S') - $1"
}

VDIRSYNC=$(which vdirsyncer) || exitEcho 1 "vdirsyncer not installed"
NPM=$(which npm) || exitEcho 1 "nodejs runtime not installed (npm missing)"

log "create vdirsync config"
CONFIG=$($NPM run vdirsync_config)

[[ $? != 0 ]] && exitEcho 2 "Config creation failed"
log "start sync from caldav server"
$VDIRSYNC sync -c $CONFIG

[[ $? != 0 ]] && exitEcho 3 "CardDAV sync failed"
echo
log "filter and prepare combined vcard for upload"
$NPM run filter

[[ $? != 0 ]] && exitEcho 4 "CardDAV filter and upload file creation failed"
echo
log "upload to gigaset dect base"
$NPM run upload
