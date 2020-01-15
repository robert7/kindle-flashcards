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

var optionator = require('optionator')({
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
            // split on new line
            .pipe(es.split())
            .pipe(
                es.mapSync(function(line) {

                    // pause the readstream
                    stream.pause();

                    lineNr += 1;

                    // process line here and call s.resume() when ready

                    const parsedLines = csvParse(line, CSV_PARSE_OPTIONS);
                    // we expect parsed line to have exactly one line
                    // and dirst item is expected to be string
                    const isLineValid = Array.isArray(parsedLines)
                        && (parsedLines.length === 1)
                        && Array.isArray(parsedLines[0])
                        && typeof parsedLines[0][0] == 'string';

                    if (isLineValid) {
                        // this is the line we got
                        const oneParsedLine = parsedLines[0];
                        // and the value at the 1st column should be non blank string
                        const keyword = oneParsedLine[0];
                        if (keyword.length > 0) {
                            while (oneParsedLine.length < CARD_COL_COUNT) {
                                oneParsedLine.push('');
                            }
                            cards.push(oneParsedLine);
                        }
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

const addTranslation = (cards) => {
    // see http://bluebirdjs.com/docs/api/promise.mapseries.html
    // or http://bluebirdjs.com/docs/api/promise.each.html

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
            //console.log(result);
            card[1] = result.text;
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
};

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

const writeToEPUBFile = (cards, fileName) => {
    const content = [];
    cards.forEach((card) => {
        content.push({
            title: card[0],
            data: `<p></p>`
        });
        content.push({
            title: card[1],
            data: `<p></p>`
        });
    });

    const option = {
        title: fileName,
        author: 'kindle-flashcards',
        content
    };

    new Epub(option, fileName);
};

// flashcard file extension
const FLASHCARD_FILE_EXT = 'csv';
// ..with "." prepended
const FLASHCARD_FILE_P_EXT = '.' + FLASHCARD_FILE_EXT;

const main = (argv) => {
    const options = optionator.parseArgv(process.argv);
    const argsAfterOptions = options._;
    let displayHelpAndQuit = options.help || (!Array.isArray(argsAfterOptions)) || (argsAfterOptions.length !== 1);

    const mainFlashCardFile = !displayHelpAndQuit ? argsAfterOptions[0] : undefined;
    displayHelpAndQuit = (!displayHelpAndQuit) && mainFlashCardFile.endsWith(FLASHCARD_FILE_P_EXT);

    if (displayHelpAndQuit) {
        console.log(optionator.generateHelp());
        process.exit(1);
    }

    const cards = [];

    const writeCardsToCSVFile = () => writeToCSVFile(cards, inputFile + '.new');
    //const writeCardsToPDFFile = () => writeToPDFFile(cards, inputFile + '.pdf');
    const writeCardsToEPUBFile = () => writeToEPUBFile(cards, inputFile + '.epub');

    readCardDataFromFile(mainFlashCardFile, cards)
        .then(addTranslation)
        .then(writeCardsToCSVFile)
        .then(writeCardsToEPUBFile)
        .then(() => {
            console.log('All done.');
        });
};

main(process.argv);




