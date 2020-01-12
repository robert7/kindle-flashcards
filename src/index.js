const fs = require('fs'),
    es = require('event-stream'),
    parse = require('csv-parse/lib/sync'),
    config = require('../config/config');

const readCardDataFromFile = (fileName, cards) => {
    let stream = fs.createReadStream(fileName)
        .pipe(es.split())           // split on new line
        .pipe(
            es.mapSync(function(line) {
                process.stdout.write(line);
                cards.push(line);
            })
        );
};

//process.stdout.write(config.apiKey);

var options = {};
var googleTranslate = require('google-translate')(config.apiKey, options);
googleTranslate.translate('My name is Brandon', 'es', function(err, translation) {
    console.log(translation.translatedText);
    // =>  Mi nombre es Brandon
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


