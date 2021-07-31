# Configuration Files

This file describes all configuration parameter defined inside the
`config/default.json` file with valid values.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| chrome.executable | string | "/usr/bin/chromium" | |
| chrome.debug | boolean | false | |
| syncContacts | list[string] | [] | |
| syncDistributionList | string | "" | |
| carddav| object | | CardDAV server related config, see below |
| local| object | | local cache files, see below |
| destination| object | | Gigaset config for upload, see below |

#### Parameter of "cardav" object

This object contains all configuration data needed to access the adressbook
on the CardDAV server.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| url | string | | |
| username | string | | |
| password | string | | |
| addressbook | string | | |

#### Parameter of "local" object

This object contains local paths (files and directories) used to store information
for synchronisation with CardDAV server and before uploading to Gigaset station.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| vsyncConfig | string | | |
| vsyncStatusDir | string | | |
| vcfBaseDir | string | | |

#### Parameter of "destination" object

This object configures all data needed to access the Gigaset station and upload
address book files there.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| vCardFile | string | | |
| gigaset.host | string | | |
| gigaset.pin | string | | |
| gigaset.deleteBeforeUpload | boolean | | |
| gigaset.handsets | list[string] | ["ALL"] | |
| gigaset.loginPage | string | | |
| gigaset.phonebookPage | string | | |
  
todo...