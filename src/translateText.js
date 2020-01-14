const config = require('../config/config');

const googleTranslateOptions = {concurrentLimit: 10};
const googleTranslate = require('google-translate')(config.apiKey, googleTranslateOptions);

/**
 * Return a promise which resolves to translation object.
 * Uses Google Cloud Translation API.
 * https://cloud.google.com/translate/docs/
 *
 * API is only free until some amount of requests.
 *
 * @param text         Text to translate.
 * @param sourceLang   Source language.
 * @param targetLang   Target language.
 * @return {Promise<unknown>}
 */
const translateText = (text, sourceLang, targetLang) => {
    return new Promise((resolve, reject) => {
        googleTranslate.translate(text, sourceLang, targetLang, (err, translation) => {
            if (err) {
                reject(err);
            }
            console.log(translation.translatedText);
            resolve(translation);
        });
    });
};

exports.translateText = translateText;

// usage example
// const translateText = require('./translateText').translateText;
// translateText('My name is Brandon', 'en', 'es').then((result) => {
//     console.log(result);
// });

