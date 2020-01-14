const fs = require('fs'),
    es = require('event-stream'),
    parse = require('csv-parse/lib/sync');
const translateText = require('@vitalets/google-translate-api');

const readCardDataFromFile = (fileName, cards) => {
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
                if (Array.isArray(parsedLine)) {
                    cards.push(parsedLine);
                }

                // resume the readstream, possibly from a callback
                stream.resume();
            })
        );
};

const addTranslation = ( cards) => {
     // see http://bluebirdjs.com/docs/api/promise.mapseries.html
    // or http://bluebirdjs.com/docs/api/promise.each.html
};




translateText('My name is Brandon', {from: 'en', to: 'es'}).then((result) => {
    console.log(result);
});

const main = (argv) => {
    if (process.argv.length < 2) {
        process.stdout.write('invalid arguments');
        process.exit(1);
    }
    const args = argv.slice(2);

    const cards = [];
    readCardDataFromFile(args[0], cards);
};

main(process.argv);


