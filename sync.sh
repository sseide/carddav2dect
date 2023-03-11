#!/usr/bin/env bash

exitEcho() {
    echo "$2"
    exit "$1"
}

log() {
    echo "$(date +'%F %H:%M:%S') - $1"
}

VDIRSYNC=$(which vdirsyncer) || exitEcho 1 "vdirsyncer not installed"
NPM=$(which npm) || exitEcho 1 "nodejs runtime not installed (npm missing)"

log "create vdirsync config"
CONFIG=$($NPM --silent run vdirsync_config)
# shellcheck disable=SC2181
[[ $? != 0 ]] && exitEcho 2 "Config creation failed"

log "start sync from caldav server with config $CONFIG"
$VDIRSYNC -c "$CONFIG" sync
SYNC_RC=$?
echo "sync rc = "$SYNC_RC
if [[ $SYNC_RC -eq 1 ]]; then
    log "first run - need discover to find all address books on carddav server"
    $VDIRSYNC -c "$CONFIG" discover dect_sync
    echo "discover rc = "$?
    log "now rerun sync"
    $VDIRSYNC -c "$CONFIG" sync
    SYNC_RC=$?
    echo "sync rc = "$SYNC_RC
fi
[[ $SYNC_RC != 0 ]] && exitEcho 3 "CardDAV sync failed"

echo
log "filter and prepare combined vcard for upload"

if ! $NPM run filter; then
  exitEcho 4 "CardDAV filter and upload file creation failed"
fi

echo
log "upload to gigaset dect base"
$NPM run upload
