const fs = require('fs'),
    es = require('event-stream'),
    parse = require('csv-parse/lib/sync');

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


