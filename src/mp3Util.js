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
 * @param internals Allows replace callbacks for easier testing; not used for normal calls.
 *
 * @return promise resolves to true on OK, and to false on failure
 */
exports.concatMp3Files = async function concatMp3Files1(mp3Files, concatedMp3Filename, internals) {

    // bit weird but, this make it testable
    const concatMp3FilesIntL = (internals && internals.concatMp3FilesInt) || concatMp3FilesInt;
    const unlinkIfExistsL = (internals && internals.unlinkIfExists) || unlinkIfExists;
    const chunkSize = (internals && internals.chunkSize) || CONCAT_CHUNK_SIZE;

    // in case there are really many files, then we divide them in groups
    // and concat in "chunks"
    // the algorithm could be written more effective, but it should be OK for our use case
    let tempFileCounter = 0;
    const tempFiles = [];
    while (mp3Files.length > chunkSize + 2) {
        const mp3FilesChunk = mp3Files.slice(0, chunkSize);
        tempFileCounter++;
        const tempFile = `tmp-${tempFileCounter}.mp3`;
        const isOK = await concatMp3FilesIntL(mp3FilesChunk, tempFile);
        if (!isOK) {
            return false;
        }
        tempFiles.push(tempFile);

        // in next stage we will concat "first temp file" & rest files or next chunk
        mp3Files = [tempFile].concat(mp3Files.slice(chunkSize));
    }

    // this is final concat into result file
    const isOK = await concatMp3FilesIntL(mp3Files, concatedMp3Filename);
    if (isOK) {
        tempFiles.forEach(file => unlinkIfExistsL(file));
    }
    return isOK;
};

