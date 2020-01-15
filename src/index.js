const
    fs = require('fs'),
    es = require('event-stream'),
    // https://www.npmjs.com/package/csv-parse
    csvParse = require('csv-parse/lib/sync'),
    csvStringify = require('csv-stringify'),
    translateText = require('@vitalets/google-translate-api'),
    Promise = require('bluebird'),
    Epub = require('epub-gen');

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

const main = (argv) => {
    if (process.argv.length < 2) {
        process.stdout.write('invalid arguments');
        process.exit(1);
    }
    // TODO meaningful command line parsing
    const args = argv.slice(2);

    const cards = [];

    const inputFile = args[0];
    const writeCardsToCSVFile = () => writeToCSVFile(cards, inputFile + '.new');
    const writeCardsToPDFFile = () => writeToPDFFile(cards, inputFile + '.pdf');
    const writeCardsToEPUBFile = () => writeToEPUBFile(cards, inputFile + '.epub');

    readCardDataFromFile(inputFile, cards)
        .then(addTranslation)
        .then(writeCardsToCSVFile)
        .then(writeCardsToEPUBFile)
        .then(() => {
            console.log('All done.');
        });
};

main(process.argv);

// const Epub = require('epub-gen');
// const option = {
//     title: 'Alice\'s Adventures in Wonderland', // *Required, title of the book.
//     author: 'Lewis Carroll', // *Required, name of the author.
//     publisher: 'Macmillan & Co.', // optional
//     //cover: 'http://demo.com/url-to-cover-image.jpg', // Url or File path, both ok.
//     content: [
//         {
//             title: 'About the author', // Optional
//             author: 'John Doe', // Optional
//             data: '<h2>Charles Lutwidge Dodgson</h2>'
//                 + '<div lang="en">Better known by the pen name Lewis Carroll...</div>' // pass html string
//         },
//         {
//             title: 'Down the Rabbit Hole',
//             data: '<p>Alice was beginning to get very tired...</p>'
//         }
//     ]
// };
// new Epub(option, 'aa.epub');


