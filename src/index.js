const
    fs = require('fs'),
    es = require('event-stream'),
    // https://www.npmjs.com/package/csv-parse
    csvParse = require('csv-parse/lib/sync'),
    csvStringify = require('csv-stringify'),
    translateText = require('@vitalets/google-translate-api'),
    Promise = require('bluebird');

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

const writeToFile = (cards, fileName) => {
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

const main = (argv) => {
    if (process.argv.length < 2) {
        process.stdout.write('invalid arguments');
        process.exit(1);
    }
    // TODO meaningful command line parsing
    const args = argv.slice(2);

    const cards = [];

    const inputFile = args[0];
    const writeCardsToFile = () => writeToFile(cards, inputFile + '.new');
    readCardDataFromFile(inputFile, cards)
        .then(addTranslation)
        .then(writeCardsToFile)
        .then(() => {
            console.log('All done.');
        });
};

main(process.argv);


