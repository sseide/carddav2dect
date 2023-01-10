#!/usr/bin/env bash

# initialization
umask 027

# be posix compliant
HOSTNAME=${HOSTNAME:-$(uname -n)}

printf 'Start CardDAV-to-DECT sync'

/app/sync.sh
