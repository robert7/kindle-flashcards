# kindle-flashcards
Set of utilities for  creating flashcards for reading on ebook reader (e.g. Kindle) or listening (narrated mp3 file).

There are tons of apps for processing flashcards on mobile devices... which have a lot of advantages
of course, but if you for any case, don't want to read the flashcards on mobile/tablet, then
ebook reader or audio player may be good option. 

Of course only the "happy path" which suit my special use cases is implemented... but the existing core can be easily extended.

## Basic idea
* Take basic CSV file (columns: key, value, note) and generate an ebook where "key, note" are one page
  and "value" is on next page.
  As you can fill the CSV with any content, this can be used to learn anything you desire.
* Optional further steps
  * for basic language learning CSV file may be generated out of a TXT file (just take 
    any TXT file e.g. particular web page text) and generate words out of it. Filter out duplicates.
    New words may be added later this way.
  * Use "Google translate" to translate keys to values 
  * Filter out trivial words (where key eq. value)
  * Shuffle values (sorted into 3 areas - see help)    
* Optional: write output to EPUB format, which may be easily converted to MOBI using some online
  service or [Calibre](https://manual.calibre-ebook.com/generated/en/ebook-convert.html).
* Optional: write output to audio format (MP3)

![Tests](https://github.com/robert7/kindle-flashcards/actions/workflows/node.js.yml/badge.svg)

## Example
Display help to see all options:

``./kf``

Process given CSV file and generate ebook:

``./kf 01.csv --import flashcards-src2.txt --epub``

Narrate given CSV file into audio version:

``./kf 01.csv --audio``

## Preconditions:
* It works only with Google Cloud account with activated billing..
* Authenticate against Google cloud:
  * [Create a service account](https://cloud.google.com/iam/docs/understanding-service-accounts)
  * [Pass credentials](https://cloud.google.com/docs/authentication/production) in the GOOGLE_APPLICATION_CREDENTIALS environment variable.
* In order mp3 merging to work, [ffmpeg must be on the path](https://www.npmjs.com/package/fluent-ffmpeg).   

