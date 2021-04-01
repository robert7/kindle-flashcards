const
    audioconcat = require('audioconcat'),
    fs = require('fs');

const CONCAT_CHUNK_SIZE = 35;

async function concatMp3FilesInt(mp3Files, concatedMp3Filename) {
    return new Promise((resolve, reject) => {

        // console.log(`Concat ${mp3Files.join(',')} => ${concatedMp3Filename}`);

        // mp3 concat (using ffmpeg): https://www.npmjs.com/package/audioconcat
        audioconcat(mp3Files)
            .concat(concatedMp3Filename)
            .on('start', function(command) {
                // console.log('ffmpeg process started:', command);
            })
            .on('error', function(err, stdout, stderr) {
                console.error('Error:', err);
                console.error('ffmpeg stderr:', stderr);
                resolve(false);
            })
            .on('end', function() {
                // console.log(`Audio created ${concatedMp3Filename}`);
                resolve(true);
            });
    });
}

function unlinkIfExists(filename) {
    if (!fs.existsSync(filename)) {
        return;
    }

    fs.unlinkSync(filename);
}

/**
 * Concat passed mp3 files into result file.
 * @param mp3Files Array with mp3's to merge
 * @param concatedMp3Filename Name for concatenated mp3
 *
 * @return promise resolves to true on OK, and to false on failure
 */
exports.concatMp3Files = async function concatMp3Files1(mp3Files, concatedMp3Filename) {

    // in case there are really many files, then we divide them in groups
    // and concat in "chunks"
    // the algorithm could be written more effective, but it should be OK for our use case
    var tempFileCounter = 0;
    const tempFiles = [];
    while (mp3Files.length > CONCAT_CHUNK_SIZE + 2) {
        const mp3FilesChunk = mp3Files.slice(0, CONCAT_CHUNK_SIZE);
        tempFileCounter++;
        const tempFile = `tmp-${tempFileCounter}.mp3`;
        const isOK = await concatMp3FilesInt(mp3FilesChunk, tempFile);
        if (!isOK) {
            return false;
        }
        tempFiles.push(tempFile);

        // in next stage we will concat "first temp file" & rest files or next chunk
        mp3Files = [tempFile].concat(mp3Files.slice(CONCAT_CHUNK_SIZE));
    }

    // this is final concat into result file
    const isOK = await concatMp3FilesInt(mp3Files, concatedMp3Filename);
    if (isOK) {
        tempFiles.forEach(file => unlinkIfExists(file));
    }
    return isOK;
};

