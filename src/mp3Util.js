const audioconcat = require('audioconcat');

/**
 * Concat passed mp3 files into result file.
 * @param mp3Files Array with mp3's to merge
 * @param concatedMp3Filename Name for concatenated mp3
 *
 * @return promise resolves to true on OK, and to false on failure
 */
exports.concatMp3Files = function concatMp3Files(mp3Files, concatedMp3Filename) {
    return new Promise((resolve, reject) => {

        // mp3 concat (using ffmpeg): https://www.npmjs.com/package/audioconcat
        audioconcat(mp3Files)
            .concat(concatedMp3Filename)
            .on('start', function(command) {
                console.log('ffmpeg process started:', command);
            })
            .on('error', function(err, stdout, stderr) {
                console.error('Error:', err);
                console.error('ffmpeg stderr:', stderr);
                resolve(false);
            })
            .on('end', function() {
                console.log('Audio created');
                resolve(true);
            });
    });
};