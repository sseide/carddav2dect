# Sync address books from CardDAV server to Gigaset DECT stations

This project contains some scripts to allow synchronisation of an addressbook from
a CardDAV server to a Gigaset DECT station. This scripts are not using or configuring a 
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
### Short install commands needed
Debian / Ubuntu:
```bash
apt-get install vdirsyncer chromium
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
Otherwise (none of booth is set) all contacts are synced into Gigaset address book.
If booth params are set the distribution list `syncDistributionList` takes precedence.

More information on different config parameters can be found in file 
[`docs/configuration.md`](docs/configuration.md)

## Compatibility

Tested with the following Gigaset PRO DECT and GO (Consumer) stations.

|  Device     | Firmware | Works | Comment |
|-------------|:--------:|:-----:|---------|
| Gigaset N510 IP PRO | 42.250   | &#10004;  |  |
| Gigaset GO 100 <br> (GO S850H) | 42.248 | &#10004; | Special version bundled with S850 Handset, probably the same as for other handset models|
| ??? |  | &#10006; | |

If there are some other devices (success / failure) please add via pull request or create issue

## External Links

1. vdirsyncer - https://github.com/pimutils/vdirsyncer
2. puppeteer - https://github.com/puppeteer/puppeteer
3. node "config" - https://github.com/lorenwest/node-config/wiki
