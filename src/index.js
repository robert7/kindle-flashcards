const
    fs = require('fs'),
    es = require('event-stream'),
    // https://www.npmjs.com/package/csv-parse
    csvParse = require('csv-parse/lib/sync'),
    csvStringify = require('csv-stringify'),
    translateText = require('@vitalets/google-translate-api'),
    Promise = require('bluebird'),
    // https://www.npmjs.com/package/epub-gen
    EPub = require('epub-gen'),
    moment = require('moment');

const PROG_NAME = 'kf';

// https://www.npmjs.com/package/optionator
const optionator = require('optionator');

const CSV_DELIMITER = ';';

const CSV_PARSE_OPTIONS = {
    columns: false,
    skip_empty_lines: true,
    delimiter: CSV_DELIMITER
};

const CSV_STRINGIFY_OPTIONS = {
    delimiter: CSV_DELIMITER
};

const COL_KEY = 0;
const COL_VALUE = 1;
const COL_COMMENT = 2;
const CARD_COL_COUNT = COL_COMMENT + 1;

/**
 * Add list of words (string array to cards).
 * @param words
 * @param cards
 */
const addCard = (words, cards) => {
    // and the value at the 1st column should be non blank string
    const keyword = words[COL_KEY];
    if (keyword.length === 0) {
        return undefined;
    }

    while (words.length < CARD_COL_COUNT) {
        words.push('');
    }
    cards.push(words);
    return words;
};

/**
 * Read card data from CSV file.
 *
 * @param fileName
 * @param cards
 * @return {Promise}
 */
async function readCardDataFromFile(fileName, cards) {
    return new Promise((resolve, reject) => {

        let lineNr = 0;

        let stream = fs.createReadStream(fileName)
            // split on new line - regex variant: .pipe(es.split(/(\r?\n)/))
            // https://github.com/dominictarr/event-stream#split-matcher
            .pipe(es.split())
            .pipe(
                es.mapSync(function(line) {

                    // pause the readstream
                    stream.pause();

                    lineNr += 1;

                    // process line here and call s.resume() when ready

                    const parsedLines = csvParse(line, CSV_PARSE_OPTIONS);
                    // we expect parsed line to have exactly one line
                    // and first item is expected to be string
                    const isLineValid = Array.isArray(parsedLines)
                        && (parsedLines.length === 1)
                        && Array.isArray(parsedLines[0])
                        && typeof parsedLines[0][COL_KEY] == 'string';

                    if (isLineValid) {
                        // this is the line we got
                        const oneParsedLine = parsedLines[0];
                        addCard(oneParsedLine, cards);

                    }

                    // resume the readstream, possibly from a callback
                    stream.resume();
                }).on('error', function(err) {
                    console.log(`Error while reading file ${fileName} (at line ${lineNr})`, err);
                    reject();
                }).on('end', function() {
                    console.log(`Read entire file ${fileName} (${lineNr} lines)`);
                    resolve(cards);
                })
            );
    });
}

async function addTranslations(cards) {
    // see http://bluebirdjs.com/docs/api/promise.mapseries.html
    // or http://bluebirdjs.com/docs/api/promise.each.html

    console.log('Starting translation..');
    let cntTranslations = 0;
    return Promise.each(cards, (card) => {
        const validCard = Array.isArray(card)
            && (card.length >= CARD_COL_COUNT)
            && (typeof card[COL_KEY] === 'string');

        if (!validCard) {
            return card;
        }

        const keyword = card[COL_KEY];
        const translation = card[COL_VALUE];
        const toBeTranslated = (!translation) || translation.length === 0;
        if (!toBeTranslated) {
            return card;
        }

        // TODO pass languages as parameters
        return translateText(keyword, {from: 'en', to: 'de'}).then((result) => {
            const translatedKeyword = result.text;
            console.log(`  translated ${keyword} to ${translatedKeyword}`);
            card[COL_VALUE] = translatedKeyword;
            cntTranslations++;
        });
    }).then(() => {
        console.log(`${cntTranslations} translations added..`);
        return cards;
    });
}

async function writeToCSVFile(cards, fileName) {
    // stringify(records, [options], callback).
    csvStringify(cards, CSV_STRINGIFY_OPTIONS, (err, output) => {
        fs.writeFile(fileName, output, function(err) {
            if (err) {
                return console.log(err);
            }
            console.log(`The file ${fileName} was saved.`);
        });
    });
    return Promise.resolve();
}

/**
 * PDF output - currently not used..
 * @param cards
 * @param fileName
 */
const writeToPDFFile = (cards, fileName) => {
    const PDFDocument = require('pdfkit');
    // Create a document
    const doc = new PDFDocument();
    // Pipe its output somewhere, like to a file or HTTP response
    // See below for browser usage
    doc.pipe(fs.createWriteStream(fileName));

    doc.fontSize(25);
    cards.forEach((card) => {
        doc.text(card[0]);
        doc.addPage();
        doc.text(card[1]);
        doc.addPage();
    });
    doc.end();
};

/**
 * EPUB output.
 * @param cards
 * @param fileName
 */
async function writeToEPUBFile(cards, fileName) {
    console.log('Starting EPUB conversion..');
    const content = [];
    cards.forEach((card) => {
        const keyword = card[0];
        const keywordTransl = card[1];
        const keywordComment = card[2];
        content.push({
            title: keyword,
            data: `<p>${keywordComment}</p>`
        });
        content.push({
            title: keywordTransl,
            data: `<p></p>`
        });
    });

    const timestamp = moment().format('DD.MM.YYYY');

    const option = {
        title: `Flashcards ${timestamp}`,
        author: 'kindle-flashcards',
        content
    };

    return new EPub(option, fileName).promise;
}

// flashcard file extension
const FLASHCARD_FILE_EXT = 'csv';
// ..with "." prepended
const FLASHCARD_FILE_P_EXT = '.' + FLASHCARD_FILE_EXT;

/**
 * Parse commandline options
 * @param argv CLI arguments.
 * @return {{help}|*} Parsed options
 */
const parseCommandLine = function(argv) {
    const configuredOptionator = optionator({
            prepend: `Usage: ${PROG_NAME} [options...] flashcards-file\n`
                + 'flashcards-file is a required parameter, it is expected to be a CSV file and it should have .csv extension.\n'
                + '\n'
                + 'Processing:\n'
                + '  Flashcard-file is read. It should exist (except option --import is used).\n'
                + '  Optionally file passed in via --import is read and new cards appended (deduplication against\n'
                + '  existing content).\n'
                + '  Optionally translation is done.\n'
                + '  Optionally deduplication against sources passed via --dedup is done.\n'
                + '  In case content of the cards file was modified, file is updated on disk (backup is created).\n'
                + '  Result is written to EPUB file.\n'
                + '\n'
                + 'Version 1.0',
            typeAliases: {filename: 'String', directory: 'String'},
            options: [{
                option: 'help',
                alias: 'h',
                type: 'Boolean',
                description: 'Display help.'
            }, {
                option: 'import',
                alias: 'i',
                type: 'filename',
                description: 'Text file to import. If flashcards-file exists, new cards will be appended to it.'
            }, {
                option: 'translate',
                type: 'Boolean',
                description: 'Try to translate lines in flashcards-file where translation is missing.',
                default: 'true'
            }, {
                option: 'dedup',
                type: 'filename|directory',
                description: '[NOT implemented yet]..\n'
                    + 'Deduplicate against existing flashcard file(s) (in case directory was passed\n'
                    + 'then it is scanned for files and all files in it are used as deduplication source.'
            }, {
                // handling of Boolean in optionator: https://www.npmjs.com/package/optionator
                // .. boolean flags (eg. --problemo, -p) which take no value and result in a true
                // if they are present, the falsey undefined if they are not present, or false if present and explicitly
                // prefixed with no (eg. --no-problemo)
                option: 'shuffle',
                type: 'Boolean',
                description: 'Turns shuffling off.\n'
                    + 'Default behaviour: reorder file (1: card with notes, 2: card without notes, 3: cards where'
                    + ' note starts with "-".\n'
                    + 'Inside of the groups the order is random.\n'
                    + '(Therefore mark cards which you want go first with note, cards which should go last with "-").',
                default: 'true'
            }, {
                option: 'trivials',
                type: 'Boolean',
                description: 'Turns off filtering of "trivials".\n'
                    + 'Default behaviour: Lines with identical key & value (question and answer) are filtered out. '
                    + 'Default: true - see previous param for disabling.',
                default: 'true'
            }, {
                option: 'epub',
                type: 'Boolean',
                description: 'Generate EPUB file. EPUB can then be converted to MOBI (Kindle) using Calibre. '
                    + 'Commandline will be provided.'
            }
            ]
        })
    ;

    const options = configuredOptionator.parseArgv(argv);
    // non option arguments
    const argsAfterOptions = options._;
    let displayHelpAndQuit = options.help || (!Array.isArray(argsAfterOptions)) || (argsAfterOptions.length !== 1);

    const mainFlashCardFile = !displayHelpAndQuit ? argsAfterOptions[0] : undefined;
    displayHelpAndQuit = displayHelpAndQuit || (!mainFlashCardFile.endsWith(FLASHCARD_FILE_P_EXT));

    options.mainFlashCardFile = mainFlashCardFile;
    options.displayHelpAndQuit = displayHelpAndQuit;
    if (displayHelpAndQuit) {
        console.log(configuredOptionator.generateHelp());
    }
    return options;
};

const normalizeTerm = (term) => {
    if (typeof term !== 'string') {
        return term;
    }
    return term.toLowerCase().replace(/\s*/, ' ').trim();
};

const addTermToDedupSet = (term, dedupSet) => {
    term = normalizeTerm(term);
    if (!term) {
        return;
    }

    dedupSet.add(term);
};

const isDuplicateCardTerm = (term, dedupSet) => {
    term = normalizeTerm(term);
    if (!term) {
        return true;
    }
    return dedupSet.has(term);
};

const REGEX_IS_NUM = /^\d/;

const isIgnoredTerm = (term) => {
    return (term.length < 3) || REGEX_IS_NUM.test(term);
};

const addCardToDedupSet = (card, dedupSet) => {
    if (!card) {
        return;
    }
    addTermToDedupSet(card[0], dedupSet);
};

async function addCardsToDedupSet(cards, dedupSet) {
    cards.forEach((card) => {
        addCardToDedupSet(card, dedupSet);
    });
    return Promise.resolve();
}

async function importFile(cards, importFileName, dedupSet) {
    if (!importFileName || (!fs.existsSync(importFileName))) {
        if (importFileName) {
            console.log(`File ${importFileName} requested to be imported, but it seems not to exist.. Ignoring..`);

        }
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {

        let wordNo = 0;
        let addedCards = 0;

        // https://github.com/dominictarr/event-stream#split-matcher
        //const WORD_REGEX = //;
        const WORD_REGEX = /(\b|\s|[",.;:#+*$/_=-])/;

        let stream = fs.createReadStream(importFileName)
            .pipe(es.split(WORD_REGEX))
            .pipe(
                es.mapSync(function(term) {
                    stream.pause();                                 // pause the readstream
                    wordNo += 1;
                    term = term.trim();

                    if (!isDuplicateCardTerm(term, dedupSet) && (!isIgnoredTerm(term))) {
                        console.log(`  adding term "${term}"`);
                        const card = addCard([term], cards);
                        addCardToDedupSet(card, dedupSet);
                        addedCards++;
                    } else {
                        if (term.length > 0) {
                            // console.log(`  ignoring skip/duplicate "${term}"`);
                        }
                    }

                    stream.resume();                                // resume the readstream
                }).on('error', function(err) {
                    console.log(`Error while reading file ${importFileName} (at word ${wordNo})`, err);
                    reject();
                }).on('end', function() {
                    console.log(`Read entire file ${importFileName} (${wordNo} words, ${addedCards} new cards added)`);
                    resolve(cards);
                })
            );
    });

}

async function filterOutTrivials(cards) {
    return cards.filter((card) => {
        const keyword = normalizeTerm(card[0]);
        const keywordTr = normalizeTerm(card[1]);
        const isTrivial = (!keyword) || (keyword === keywordTr);
        if (isTrivial) {
            console.log(`Filtering out trivial ${keyword} to ${keywordTr}`);
        }
        return !isTrivial;
    });
}

/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

async function shuffleCards(cards) {
    console.log('Shuffling..');
    const prio1 = [];
    const prio2 = [];
    const prio3 = [];

    cards.forEach((card) => {
        const cardComment = card[COL_COMMENT];
        const isSkip = cardComment.startsWith('-');
        const isNonBlank = !!cardComment;

        let targetList;
        if (isSkip) {
            targetList = prio3;
        } else if (isNonBlank) {
            targetList = prio1;
        } else {
            targetList = prio2;
        }
        targetList.push(card);
    });
    shuffle(prio1);
    shuffle(prio2);
    shuffle(prio3);

    return prio1.concat(prio2).concat(prio3);
}

async function main(argv) {
    const options = parseCommandLine(argv);
    const {
        mainFlashCardFile,
        displayHelpAndQuit,
        import: paramImportFileName,
        translate: paramTranslate,
        shuffle: paramShuffle,
        trivials: paramTrivials,
        epub: paramEpub
    } = options;
    if (displayHelpAndQuit) {
        process.exit(1);
    }

    let cards = [];
    const dedupSet = new Set();

    const mainCardsOutputFile = mainFlashCardFile.replace(/\.csv/, '-new.csv');
    const outputEPUBFile = mainFlashCardFile.replace(/\.csv/, '.epub');
    const outputMOBIFile = mainFlashCardFile.replace(/\.csv/, '.mobi');
    if ((mainCardsOutputFile === mainFlashCardFile) || (outputEPUBFile === mainFlashCardFile)) {
        console.log('Failed to generate output filenames (input filename should have extension ".csv"');
    }
    console.log(`CSV output: ${mainCardsOutputFile}, EPUB output: ${outputEPUBFile}`);

    await readCardDataFromFile(mainFlashCardFile, cards);
    await addCardsToDedupSet(cards, dedupSet);
    await importFile(cards, paramImportFileName, dedupSet);

    if (paramTranslate) {
        await addTranslations(cards);
    }

    if (paramTrivials) {
        cards = await filterOutTrivials(cards);
    }

    if (paramShuffle) {
        cards = await shuffleCards(cards);
    }

    await writeToCSVFile(cards, mainCardsOutputFile);

    if (paramEpub) {
        await writeToEPUBFile(cards, outputEPUBFile);
        console.log('\nYou can use Calibre to generate the MOBI file.');
        console.log(`Run: ebook-convert ${outputEPUBFile} ${outputMOBIFile}`);
    } else {
        console.log('No EPUB output..');
    }
    console.log('All done.');
}

main(process.argv);




