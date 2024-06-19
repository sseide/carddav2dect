# Sync address books from CardDAV server to Gigaset DECT stations

This project contains some scripts to allow synchronisation of an addressbook from
a CardDAV server to a Gigaset DECT station. These scripts are not using or configuring a 
external/system-wide address book at the Gigaset system but upload the address data 
directly to all/selected handsets as local address books.

## Prerequisits

These scripts use the application "vdirsyncer" [[1]](#external-links) to sync the carddav servers address book with local vCard files.

To upload the generated vCard to the Gigaset DECT station puppeteer (headless chromium dev-tools [[2]](#external-links))
is used to navigate the Gigaset web pages.

As puppeteer has a very strict dependency on the version of chromium/chrome used this
might be adapted inside package.json to either use the correct version or let
puppeteer install the version it needs by itself.
For puppeteer compatibility matrix check  

### Short installation commands needed
Debian / Ubuntu:
```bash
apt-get install vdirsyncer chromium
npm install
```

## Configuration

The node "config" module is [[3]](#external-links) used here, therefor all config changes MUST go into your local
`config/local.json` config file. Do NOT change the provided `config/default.json` file!
Only the params different from the default config should be added to the local.json config file
to overwrite these defaults.

Minimum data to set inside `config/local.json`:
```json
{
  "syncDistributionList": "server-side_list_name",
  "cardDav": {
    "url": "https://groupdav.server.ip/egroupware/groupdav.php/addressbook/",
    "username": "myuser",
    "password": "mypass"
  },
  "destination": {
    "gigaset": {
      "host": "http://my.gigaset.dect.ip",
      "pin": "0000"
    }
  }
}
```
Either set the name of a vCard distribution list `syncDistributionList` or an array
with all contact names (full name attribute FN) 'syncContacts' to sync.
Otherwise, (none of booth is set) all contacts are synced into Gigaset address book.
If booth params are set the distribution list `syncDistributionList` takes precedence.

More information on different config parameters can be found in file 
[`docs/configuration.md`](docs/configuration.md)

## Run

To do a full snyc cycle (fetch latest address card entries and upload to a handset)
just run `sync.sh` script. its do all steps neccesary.

## Compatibility

Tested with the following Gigaset PRO DECT and GO (Consumer) stations.

Important: these sytems allow one one login at a time - it is not possible to
log into the Gigaset device in parallel multiple times. And it is important 
to log out at the end and not just close the browser!

This sync script cannot run with another user logged into the station.
in this case an error message will be shown:
```
LOGIN DIALOG MSG: Kein Zugriff möglich, da bereits eine Konfigurationssitzung
 auf einem anderen Client aktiv ist.
```

In this case do one of the following befor running sync again:
1. log out your other browser session or 
2. wait some minutes until Gigaset station do a forced logout of the user or
3. reboot station.

Tested with:

| Device                         | Firmware |  Works   | Comment                                                                                  |
|--------------------------------|:--------:|:--------:|------------------------------------------------------------------------------------------|
| Gigaset N510 IP PRO            |  42.250  | &#10004; |                                                                                          |
| Gigaset GO 100 <br> (GO S850H) |  42.248  | &#10004; | Special version bundled with S850 Handset, probably the same as for other handset models |
| ???                            |          | &#10006; |                                                                                          |

If there are some other devices (success / failure) please add via pull request or create issue

## External Links

1. vdirsyncer - https://github.com/pimutils/vdirsyncer
2. puppeteer - https://github.com/puppeteer/puppeteer
3. node "config" - https://github.com/lorenwest/node-config/wiki
