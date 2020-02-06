# kindle-flashcards
Set of utilities for  creating flashcards for reading on ebook reader (e.g. Kindle).
There are tons of apps for processing flashcards on mobile devices.. which have a lot of advantages
of course, but if you for any case, don't want to read the flashcards on mobile/tablet, then
ebook reader may be good option. 

.. work in progress..

Basic idea:
* take basic CSV file (columns: key, value, note) and generate ebook where key*note is one page
  and value next page.
* (optional step) for basic language learning CSV file may be generated out of a TXT file (just take 
  any TXT file) and generate words. Filter out duplicates
* (optional step) use Google translate to translate keys to values 
* (optional step) filter out trivials (where key eq. value)
* (optional step) shuffle values (sorted into 3 areas - see help)    

Currently output is generated to EPUB format, which may be easily converted to MOBI using some online
service or [Calibre](https://manual.calibre-ebook.com/generated/en/ebook-convert.html).


# Example
``./kf flashcards-src2.txt``
