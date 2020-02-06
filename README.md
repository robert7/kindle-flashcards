# kindle-flashcards
Set of utilities for  creating flashcards for reading on ebook reader (e.g. Kindle).
There are tons of apps for processing flashcards on mobile devices.. which have a lot of advantages
of course, but if you for any case, don't want to read the flashcards on mobile/tablet, then
ebook reader may be good option. 

.. work in progress..

Basic idea:
* take basic CSV file (columns: key, value, note) and generate ebook where "key, note" are one page
  and "value" is on next page.
  As you can fill the CSV with any content, this can be used to learn anything you desire.
* optional further steps
  * for basic language learning CSV file may be generated out of a TXT file (just take 
    any TXT file e.g. particular web page text) and generate words out of it. Filter out duplicates.
    New words may be added later this way.
  * Use Google translate to translate keys to values 
  * Filter out trivials (where key eq. value)
  * Shuffle values (sorted into 3 areas - see help)    

Currently output is generated to EPUB format, which may be easily converted to MOBI using some online
service or [Calibre](https://manual.calibre-ebook.com/generated/en/ebook-convert.html).


# Example
Display help:

``./kf -h``

Process given CSV file and generate ebook:

``./kf flashcards-src2.txt``
