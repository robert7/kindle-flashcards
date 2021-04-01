const
    fs = require('fs'),
    fspromises = require('fs').promises,
    es = require('event-stream'),
    // https://www.npmjs.com/package/csv-parse
    csvParse = require('csv-parse/lib/sync'),
    csvStringify = require('csv-stringify'),
    Promise = require('bluebird'),
    // https://www.npmjs.com/package/epub-gen
    EPub = require('epub-gen'),
    moment = require('moment'),
    crypto = require('crypto'),
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    {synthesizeSsml} = require('./gcpTextToSpeech'),
    {translate} = require('./gcpTranslate'),
    {concatMp3Files} = require('./mp3Util'),
    {SlovakStemmer} = require('./SlovakStemmer');

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

const REGEX_IS_NUM = /^\d/;

// \b doesn't work well for non english texts
const REGEX_WORD = /(\s|[?"„“‚‘(),.;:#+*$/_=-])/;


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

        if (!fs.existsSync(fileName)) {
            console.log(`Inout card file ${fileName} seem not to exist, assuming we start from scratch.`);
            resolve(cards);
            return;
        }

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
                    console.log(`Error while reading file ${fileName} (at line ${lineNr}).`, err);
                    reject();
                }).on('end', function() {
                    console.log(`Read entire file ${fileName} (${lineNr} lines).`);
                    resolve(cards);
                })
            );
    });
}

const DEFAULT_LANGUAGES = {from: 'en', to: 'de'};

async function addTranslations(cards, options) {
    // see http://bluebirdjs.com/docs/api/promise.mapseries.html
    // or http://bluebirdjs.com/docs/api/promise.each.html

    if (!options.from) {
        options.from = DEFAULT_LANGUAGES.from;
    }
    if (!options.to) {
        options.to = DEFAULT_LANGUAGES.to;
    }
    const limit = options.limit;

    console.log(`Starting translation (from ${options.from} to ${options.to})..`);

    let cntTranslations = 0;
    try {
        for (const card of cards) {

            const validCard = Array.isArray(card)
                && (card.length >= CARD_COL_COUNT)
                && (typeof card[COL_KEY] === 'string');

            if (!validCard) {
                continue;
            }

            const keyword = card[COL_KEY];
            const translation = card[COL_VALUE];
            const toBeTranslated = (!translation) || translation.length === 0;
            if (!toBeTranslated) {
                continue;
            }

            const translatedKeyword = await translate(keyword, {from: options.from, to: options.to});
            console.log(`  translated \"${keyword}\" to \"${translatedKeyword}\"`);
            card[COL_VALUE] = translatedKeyword;
            cntTranslations++;

            if (limit && (cntTranslations >= limit)) {
                console.log(`Maximum ${limit} translations reached (=> end)..`);
                break;
            }
        }
    } catch (e) {
        console.log(`Translation fail: ${e}`);
    }

    console.log(`${cntTranslations} translations added..`);
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
        doc.text(card[COL_KEY]);
        doc.addPage();
        doc.text(card[COL_VALUE]);
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
        const keyword = card[COL_KEY];
        const keywordTransl = card[COL_VALUE];
        const keywordComment = card[COL_COMMENT];
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
            typeAliases: {filename: 'String', directory: 'String', language: 'String', count: 'Number'},
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
                description: 'Translate lines in flashcards-file where translation is missing.',
                default: 'false'
            }, {
                // handling of Boolean in optionator: https://www.npmjs.com/package/optionator
                // .. boolean flags (eg. --problemo, -p) which take no value and result in a true
                // if they are present, the falsey undefined if they are not present, or false if present and explicitly
                // prefixed with no (eg. --no-problemo)
                option: 'shuffle',
                type: 'Boolean',
                description: 'Shuffle cards.\n'
                    + 'Default behaviour: reorder content (1: cards with notes, 2: cards without notes, 3: cards where'
                    + ' note starts with "-".\n'
                    + 'Inside of the groups the order is random.\n'
                    + 'Therefore mark cards which you want go first with note, cards which should go last with "-",\n'
                    + 'special note "*" will be interpreted as blank.'
            }, {
                option: 'trivials',
                type: 'Boolean',
                description: 'Filter out "trivials". Default behaviour: lines with identical key & value (question and answer) are filtered out. '
            }, {
                option: 'epub',
                type: 'Boolean',
                description: 'Generate EPUB file. EPUB can then be converted to MOBI (Kindle) using Calibre. '
                    + 'Commandline will be provided.'
            }, {
                option: 'audio',
                type: 'Boolean',
                description: 'Generate mp3 audio version. Experimental.'
            }, {
                option: 'langFrom',
                type: 'language',
                description: 'Translate from language.'
            }, {
                option: 'langTo',
                type: 'language',
                description: 'Translate to language.'
            }, {
                option: 'stem',
                type: 'Boolean',
                description: 'While importing text (--import) use stemming in deduplication of cards.'
                    + ' Currently only works for "sk" language.'
            }, {
                option: 'limit',
                type: 'count',
                description: 'For translation: max. cards to translate, for audio rendering: max cards to'
                    + 'render in audio (useful for testing/experiments).'
            }, {
                option: 'dedup',
                type: 'filename',
                description: 'Deduplicate against existing flashcard file.'
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

const slovakStemmer = new SlovakStemmer();

const normalizeTerm = (term, options) => {
    const origTerm = term;
    if (typeof term !== 'string') {
        return term;
    }

    term = term.toLowerCase().replace(/\s*/, ' ').trim();

    if (options && options.stem) {
        const terms = term.split(REGEX_WORD);
        if (terms.length > 1) {
            term = terms[0];
        }
        term = slovakStemmer.stem(term);
    }
    // console.log(`Normalized term "${origTerm}" => "${term}"`);
    return term;
};

const addTermToDedupMap = (term, dedupMap, options) => {
    term = normalizeTerm(term, options);
    if (!term) {
        return;
    }

    dedupMap.set(term, null);
};

const isDuplicateCardTerm = (term, dedupMap, options) => {
    term = normalizeTerm(term, options);
    if (!term) {
        return true;
    }
    return dedupMap.has(term);
};


const isIgnoredTerm = (term) => {
    return (term.length < 3) || REGEX_IS_NUM.test(term);
};

const addCardToDedupMap = (card, dedupMap, options) => {
    if (!card) {
        return;
    }
    addTermToDedupMap(card[COL_KEY], dedupMap, options);
};

async function addCardsToDedupMap(cards, dedupMap, options) {
    cards.forEach((card) => {
        addCardToDedupMap(card, dedupMap, options);
    });
    return Promise.resolve();
}

async function importFile(cards, importFileName, dedupMap, options) {
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

        let stream = fs.createReadStream(importFileName)
            .pipe(es.split(REGEX_WORD))
            .pipe(
                es.mapSync(function(term) {
                    stream.pause();                                 // pause the readstream
                    wordNo += 1;
                    term = term.trim().toLowerCase();

                    if (!isDuplicateCardTerm(term, dedupMap, options) && (!isIgnoredTerm(term))) {
                        console.log(`  Adding new card term "${term}"`);
                        const card = addCard([term], cards);
                        addCardToDedupMap(card, dedupMap, options);
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

async function filterOutTrivials(cards, dedupMap, options) {
    const filteredCards = cards.filter((card) => {
        const keyword = normalizeTerm(card[COL_KEY]);
        const keywordTr = normalizeTerm(card[COL_VALUE]);
        const isTrivial = (!keyword) || (keyword === keywordTr);
        if (isTrivial) {
            console.log(`Filtering out trivial ${keyword} to ${keywordTr}`);
        }
        return !isTrivial;
    });

    // filteredCards.forEach(card => {
    //     const keyword = card[COL_KEY];
    //     const keywordNorm = normalizeTerm(keyword);
    //     if (isDuplicateCardTerm(keywordNorm, dedupMap, options)) {
    //         console.log(`${keyword} appears to be duplicate`);
    //     }
    // });

    return filteredCards;
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

function generateOutputFileName(mainFlashCardFile, newFileEnding) {
    return mainFlashCardFile.replace(/\.csv/, newFileEnding);
}

const DEFAULT_VOICE2 = {
    name: 'en-US-Wavenet-C',
    ssmlGender: 'FEMALE',
    languageCode: 'en-US'
};

const DEFAULT_VOICE_KEYWORD = {
    name: 'sk-SK-Standard-A',
    ssmlGender: 'FEMALE',
    languageCode: 'sk-SK'
};

const DEFAULT_VOICE_TRANSL = {
    name: 'de-DE-Standard-A',
    ssmlGender: 'FEMALE',
    languageCode: 'de-DE'
};

DEFAULT_SPEAKING_RATE = 0.8;

function ssmlWrap(text, breakTime) {
    const sentence = (!text || text === '') ? '' : `<p>${text}</p>`;

    return `<speak>${sentence}<break time="${breakTime}s"/></speak>`;
}

const CACHE_DIR = './c';

/**
 * Get hash string based on card data.
 * This should be unique identification of a card.
 *
 * @param card
 * @return {string}
 */
function getCardHash(card) {
    const keyword = card[COL_KEY];
    const keywordTransl = card[COL_VALUE];

    const hash = crypto.createHash('md5')
        .update(keyword)
        .update(keywordTransl)
        .digest('hex');
    return hash;
}

async function writeToMP3FileOne(mp3List, card, index, outputMP3FileBase) {
    const keyword = card[COL_KEY];
    const keywordTransl = card[COL_VALUE];

    const cardHash = getCardHash(card);

    // note we could add the language to the filename, but if has not real sense to use various languages
    // so the language is given by the card content
    const fileName1 = `${CACHE_DIR}/${cardHash}-1.mp3`;
    const fileName2 = `${CACHE_DIR}/${cardHash}-2.mp3`;

    // the audio files corresponding to current card, will be recreated (only) if content of the card changed
    if (!fs.existsSync(fileName1)) {
        const ssml1 = ssmlWrap(keyword, 3);
        await synthesizeSsml(ssml1, fileName1, DEFAULT_VOICE_KEYWORD, DEFAULT_SPEAKING_RATE);

        const ssml3 = ssmlWrap(keywordTransl, 2);
        await synthesizeSsml(ssml3, fileName2, DEFAULT_VOICE_TRANSL, DEFAULT_SPEAKING_RATE);
    }

    mp3List.push(fileName1);
    mp3List.push(fileName2);
}

async function checkOrCreateCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        await fspromises.mkdir(CACHE_DIR);
    }
}

async function writeToMP3File(cards, outputMP3FileBase, options) {
    await checkOrCreateCacheDir();

    // count of cards to process may be limited by options
    const limit = options.limit;
    const cardsToProcess = limit ? cards.slice(0, limit) : cards;

    const mp3Files = [];

    var index = 0;
    for (const card of cardsToProcess) {
        await writeToMP3FileOne(mp3Files, card, index, outputMP3FileBase);
        index++;
    }
    if (limit) {
        console.log(`Count of cards to process in audio reached (${limit}).`);
    }
    const resultMp3 = `${outputMP3FileBase}.mp3`;

    const concatOK = await concatMp3Files(mp3Files, resultMp3);
    if (!concatOK) {
        console.log('Audio concat failed!');
    } else {
        console.log(`Audio ${resultMp3} created.`);
    }
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
        audio: paramAudio,
        epub: paramEpub,
        langFrom: paramLangFrom,
        langTo: paramLangTo,
        limit: paramLimit,
        dedup: paramDedup
    } = options;
    if (displayHelpAndQuit) {
        process.exit(1);
    }

    let cards = [];
    const dedupMap = new Map();

    const mainCardsOutputFile = generateOutputFileName(mainFlashCardFile, '-new.csv');
    if (mainCardsOutputFile === mainFlashCardFile) {
        console.log('Failed to generate output filenames (input filename should have extension ".csv"');
    }
    console.log(`CSV output: ${mainCardsOutputFile}`);

    await readCardDataFromFile(mainFlashCardFile, cards);
    await addCardsToDedupMap(cards, dedupMap, options);

    if (paramDedup) {
        const cardsDedup = [];
        // paramDedup is the CSV filename used as "ignore" content
        await readCardDataFromFile(paramDedup, cardsDedup);
        await addCardsToDedupMap(cardsDedup, dedupMap, options);
    }

    await importFile(cards, paramImportFileName, dedupMap, options);

    if (paramTranslate) {
        await addTranslations(cards, {
                from: paramLangFrom,
                to: paramLangTo,
                limit: paramLimit
            }
        );
    }

    if (paramTrivials) {
        cards = await filterOutTrivials(cards, dedupMap, options);
    }

    if (paramShuffle) {
        cards = await shuffleCards(cards);
    }

    await writeToCSVFile(cards, mainCardsOutputFile);

    if (paramEpub) {
        const outputEPUBFile = generateOutputFileName(mainFlashCardFile, '.epub');
        const outputMOBIFile = generateOutputFileName(mainFlashCardFile, '.mobi');
        console.log(`EPUB output: ${outputEPUBFile}`);
        await writeToEPUBFile(cards, outputEPUBFile);
        console.log('\nYou can use Calibre to generate the MOBI file.');
        console.log(`Run: ebook-convert ${outputEPUBFile} ${outputMOBIFile}`);
    } else {
        console.log('No EPUB output..');
    }
    if (paramAudio) {
        console.log('About to generate audio version..');
        const outputMP3FileBase = generateOutputFileName(mainFlashCardFile, '');
        console.log(`MP3 output base: ${outputMP3FileBase}`);
        await writeToMP3File(cards, outputMP3FileBase, options);

    }

    console.log('All done.');
}

main(process.argv);




