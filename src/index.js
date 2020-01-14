const
    fs = require('fs'),
    es = require('event-stream'),
    parse = require('csv-parse/lib/sync'),
    translateText = require('@vitalets/google-translate-api'),
    Promise = require('bluebird');

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
                    const parsedLine = parse(line, {
                        columns: false,
                        skip_empty_lines: true,
                        delimiter: ';'
                    });
                    if (Array.isArray(parsedLine) && (parsedLine.length === 1)) {
                        const oneParsedLine = parsedLine[0];
                        cards.push(oneParsedLine);
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

    return Promise.each(cards, (card) => {
        if (!Array.isArray(card) || (card.length < 1)) {
            return;
        }
        if (card.length < 2) {
            card.push(null);
        }
        const text = card[0];
        if (!card) {
            return;
        }

        return translateText(text, {from: 'en', to: 'de'}).then((result) => {
            console.log(result);
            card[1] = result.text;
        });
    }).then(() => {
        return cards;
    });
};

const main = (argv) => {
    if (process.argv.length < 2) {
        process.stdout.write('invalid arguments');
        process.exit(1);
    }
    const args = argv.slice(2);

    const cards = [];
    readCardDataFromFile(args[0], cards).then(addTranslation).then(() => {
        console.log(cards);
    });
};

main(process.argv);


