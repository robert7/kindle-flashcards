const
    // https://www.npmjs.com/package/@google-cloud/translate
    {Translate} = require('@google-cloud/translate').v2;


/**
 *
 * @param input Text to translate
 * @param options: TranslateRequest
 * @return {Promise<*>}
 */
exports.translate = async function translate(input,options) {
    // should be autodetected
    const projectId = undefined;
    const translate = new Translate({projectId});

    // see https://github.com/googleapis/nodejs-translate/blob/master/src/v2/index.ts
    const [translation] = await translate.translate(input, options);
    return translation;
};


