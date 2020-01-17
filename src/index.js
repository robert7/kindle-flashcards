const
    fs = require('fs'),
    es = require('event-stream'),
    // https://www.npmjs.com/package/csv-parse
    csvParse = require('csv-parse/lib/sync'),
    csvStringify = require('csv-stringify'),
    translateText = require('@vitalets/google-translate-api'),
    Promise = require('bluebird'),
    Epub = require('epub-gen');

const PROG_NAME = 'kf';

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

const CARD_COL_COUNT = 3;

/**
 * Add list of words (string array to cards).
 * @param words
 * @param cards
 */
const addCard = (words, cards) => {
    // and the value at the 1st column should be non blank string
    const keyword = words[0];
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
const readCardDataFromFile = (fileName, cards) => {
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
                        && typeof parsedLines[0][0] == 'string';

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
};

const addTranslations = (cards) => {
    // see http://bluebirdjs.com/docs/api/promise.mapseries.html
    // or http://bluebirdjs.com/docs/api/promise.each.html

    console.log('Starting translation..');
    let cntTranslations = 0;
    return Promise.each(cards, (card) => {
        const validCard = Array.isArray(card)
            && (card.length >= CARD_COL_COUNT)
            && (typeof card[0] === 'string');

        if (!validCard) {
            return card;
        }

        const keyword = card[0];
        const translation = card[1];
        const toBeTranslated = (!translation) || translation.length === 0;
        if (!toBeTranslated) {
            return card;
        }

        // TODO pass languages as parameters
        return translateText(keyword, {from: 'en', to: 'de'}).then((result) => {
            const translatedKeyword = result.text;
            console.log(`  translated ${keyword} to ${translatedKeyword}`);
            card[1] = translatedKeyword;
            cntTranslations++;
        });
    }).then(() => {
        console.log(`${cntTranslations} translations added..`);
        return cards;
    });
};

const writeToCSVFile = (cards, fileName) => {
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
};

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
const writeToEPUBFile = (cards, fileName) => {
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

    const option = {
        title: fileName,
        author: 'kindle-flashcards',
        content
    };

    new Epub(option, fileName);
    return Promise.resolve();
};

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
            + '  Optionally file passed in via --import is read and new cards appended (deduplication against'
            + '  existing content).\n'
            + '  Optionally translation is done.\n'
            + '  Optionally deduplication against sources passed via --dedup is done.\n'
            + '  In case content of the cards file was modified, filew is updated on disk (backup is created).\n'
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
            alias: 't',
            type: 'Boolean',
            description: 'Try to translate lines in flashcards-file where translation is missing.'
        }, {
            option: 'dedup',
            alias: 'f',
            type: 'filename|directory',
            description: 'Deduplicate against existing flashcard file(s) (in case directory was passes '
                + 'then it is scanned for files and all files in it are used as deduplication source.'
        }
        ]
    });

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

const addCardsToDedupSet = (cards, dedupSet) => {
    cards.forEach((card) => {
        addCardToDedupSet(card, dedupSet);
    });
    return Promise.resolve();
};

const importFile = (cards, importFileName, dedupSet) => {
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

};

const filterOutTrivials = (cards) => {
    return cards.filter((card) => {
        const keyword = normalizeTerm(card[0]);
        const keywordTr = normalizeTerm(card[1]);
        const isTrivial = (!keyword) || (keyword === keywordTr);
        if (isTrivial) {
            console.log(`Filtering out trivial ${keyword} to ${keywordTr}`);
        }
        return !isTrivial;
    });
};

const main = (argv) => {
    const options = parseCommandLine(argv);
    const {mainFlashCardFile, displayHelpAndQuit, import: importFileName} = options;
    if (displayHelpAndQuit) {
        process.exit(1);
    }

    let cards = [];
    const dedupSet = new Set();

    const mainCardsOutputFile = mainFlashCardFile + '.new';
    const outputEPUBFile = mainFlashCardFile + '.epub';

    readCardDataFromFile(mainFlashCardFile, cards)
        .then(() => addCardsToDedupSet(cards, dedupSet))
        .then(() => importFile(cards, importFileName, dedupSet))
        .then(() => addTranslations(cards))
        .then(() => {
            // warn. we modify the array inplace; may not be as clean as it should be
            cards = filterOutTrivials(cards);
        })
        .then(() => writeToCSVFile(cards, mainCardsOutputFile))
        .then(() => writeToEPUBFile(cards, outputEPUBFile))
        .then(() => {
            console.log('All done.');
        });
};

main(process.argv);




