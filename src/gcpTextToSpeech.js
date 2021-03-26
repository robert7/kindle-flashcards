const
    // https://www.npmjs.com/package/@google-cloud/text-to-speech
    textToSpeech = require('@google-cloud/text-to-speech'),
    util = require('util'),
    fs = require('fs');

const DEFAULT_VOICE = {
    name: 'en-US-Wavenet-C',
    ssmlGender: 'FEMALE',
    languageCode: 'en-US'
};
DEFAULT_SPEAKING_RATE = 0.8;

exports.listVoices = async function listVoices() {
    const client = new textToSpeech.TextToSpeechClient();

    const [result] = await client.listVoices({});
    const voices = result.voices;

    voices.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));

    voices.forEach(voice => {
        const languagesStr = voice.languageCodes.join(' ');
        console.log(`${voice.name}, ${voice.ssmlGender}, ${languagesStr}`);
    });
};

// SSML: https://cloud.google.com/text-to-speech/docs/ssml

/**
 * Synthetize given SSML into mp3 output using given voice.
 * @param ssml
 * @param outputFile
 * @param voice
 * @return {Promise<void>}
 */
exports.synthesizeSsml = async function synthesizeSsml(ssml, outputFile, voice, speakingRate) {
    const client = new textToSpeech.TextToSpeechClient();

    if (!voice) {
        voice = DEFAULT_VOICE;
    }
    if (!speakingRate) {
        speakingRate = DEFAULT_SPEAKING_RATE;
    }

    const request = {
        input: {ssml},
        // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize#VoiceSelectionParams
        voice,
        // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize#AudioConfig
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate
        }
    };

    const [response] = await client.synthesizeSpeech(request);
    const writeFile = util.promisify(fs.writeFile);
    await writeFile(outputFile, response.audioContent, 'binary');
    console.log(`Audio content written to file: ${outputFile}`);
};