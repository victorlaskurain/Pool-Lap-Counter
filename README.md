# Lap counter

Simple app to count your laps on the swimming pool.

The implementations uses a combination of Owl and Onsen UI for the presentation.

## Features

- Record lap times. You can tap the screen or use the right arrow key for that.
- Store each lap time as it is record using indexed Db and push it to a Google Spreadsheet.

## TODO

- Add internationalization support (translation).
- Add graphics to display the session.

## Build

Deploy dependencies with:

``` shen
npm install
```
Apply patches with:

``` shen
npm run patch
```
