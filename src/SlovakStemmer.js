/**
 * source: https://github.com/essential-data/stemmer-sk
 * transcribed JS by: https://wyattades.github.io/java-to-javascript/
 * then slightly adapted
 */

// following functions are rewrites from Lucene StemmerUtil
// see also https://lucene.apache.org/core/7_3_1/analyzers-common/org/apache/lucene/analysis/util/StemmerUtil.html

/**
 * Returns true if the character array ends with the suffix.
 * @param s - Input Buffer
 * @param len - length of input buffer
 * @param suffix - Suffix string to test
 *
 * @return {boolean}
 */
function endsWith(s, len, suffix) {
    const suffixL = suffix.length;
    if (suffixL > len) {
        return false;
    }
    return s.substr(0, len).endsWith(suffix);
}

/**
 *
 * @param s - Input Buffer
 * @param len - length of input buffer
 * @param  prefix - Prefix string to test
 *
 * @return {boolean}
 */
function startsWith(s, len, prefix) {
    const prefixL = prefix.length;
    if (prefixL > len) {
        return false;
    }
    return s.startsWith(prefix);
}

/**
 * Original name: Delete n characters in-place
 * in JS version it simply returns new "s" & "len".
 *
 *
 * @param s - Input Buffer (string)
 * @param pos - Position of character to delete
 * @param len - Length of input buffer
 * @param nChars - number of characters to delete
 *
 * @return object {s, len}
 */
function deleteN(s, pos, len, nChars) {
    s = s.substr(0, len);

    s = s.substr(0, pos) + s.substr(pos + nChars);
    len = s.length;
    return {s, len};
}

function replaceChar(s, pos, c) {
    return s.substr(0, pos) + c + s.substr(pos + 1);
}

exports.startsWith = startsWith;
exports.endsWith = endsWith;
exports.deleteN = deleteN;
exports.replaceChar = replaceChar;

exports.SlovakStemmer = class SlovakStemmer {

    // TODO: spracovanie slov končiacich na "nenie"
    // TODO: slovesá
    
    stem(s) {
        if (!s) {
            return s;
        }

        var len = s.length;

        let t = this.removePrefix(s, len);
        len = t.len;
        s = t.s.substr(0, len);

        len = this.removeCase(s, len);
        len = this.removePossessives(s, len);
        if (len > 0) {
            t = this.normalize(s, len);
            len = t.len;
            s = t.s.substr(0, len);
        }
        if (len > 0) {
            t = this.normalize2(s, len);
            len = t.len;
            s = t.s.substr(0, len);
        }
        return s.substr(0, len);
    }

    removePrefix(s, len) {
        if (len > 6 && startsWith(s, len, 'naj')) {
            return deleteN(s, 0, len, 3);
        }
        return {s, len};
    }

    removeCase(s, len) {
        if (len > 9 && endsWith(s, len, 'ejšieho')
            || endsWith(s, len, 'ejšiemu')) {
            return len - 7;
        }

        if (len > 8 && (endsWith(s, len, 'ejších') ||
            endsWith(s, len, 'encoch') ||
            endsWith(s, len, 'ejšími') ||
            endsWith(s, len, 'encami'))) {
            return len - 6;
        }

        if (len > 7 && (endsWith(s, len, 'ejšia') ||
            endsWith(s, len, 'atami') ||
            endsWith(s, len, 'atách') ||
            endsWith(s, len, 'eniec') ||
            endsWith(s, len, 'encom') ||
            endsWith(s, len, 'ejšom') ||
            endsWith(s, len, 'ejším') ||
            endsWith(s, len, 'ejšej') ||
            endsWith(s, len, 'ejšou') ||
            endsWith(s, len, 'ejšiu') ||
            endsWith(s, len, 'ejšie'))) {
            return len - 5;
        }

        if (len > 6 &&
            (endsWith(s, len, 'eťom') ||
                endsWith(s, len, 'iami') ||
                endsWith(s, len, 'atám') ||
                endsWith(s, len, 'aťom') ||
                endsWith(s, len, 'ovia') ||
                endsWith(s, len, 'iach') ||
                endsWith(s, len, 'atám') ||
                endsWith(s, len, 'ence') ||
                endsWith(s, len, 'ieho') ||
                endsWith(s, len, 'iemu') ||
                endsWith(s, len, 'ieme') ||
                endsWith(s, len, 'iete') ||
                endsWith(s, len, 'ejší'))) {
            return len - 4;
        }

        if (len > 5 &&
            (endsWith(s, len, 'ich') || //From cz
                endsWith(s, len, 'eho') ||
                endsWith(s, len, 'ych') ||
                endsWith(s, len, 'ích') ||//From cz
                endsWith(s, len, 'ého') ||//From cz
                endsWith(s, len, 'emi') ||//From cz
                endsWith(s, len, 'ému') ||//From cz
                endsWith(s, len, 'emu') ||
                /*endsWith(s, len, "iho") ||*///Veľmi malý vplyv
                endsWith(s, len, 'ími') ||//From cz
                endsWith(s, len, 'imi') ||
                endsWith(s, len, 'ách') ||//From cz
                endsWith(s, len, 'ých') ||//From cz
                endsWith(s, len, 'ami') ||//From cz
                /*                        endsWith(s, len, "ové") ||
                                        endsWith(s, len, "ový") ||
                                        endsWith(s, len, "oví") ||*/
                endsWith(s, len, 'ovi') ||//From cz
                endsWith(s, len, 'ieť') ||
                endsWith(s, len, 'ieš') ||
                endsWith(s, len, 'ejú') ||
                endsWith(s, len, 'ajú') ||
                endsWith(s, len, 'ujú') ||
                endsWith(s, len, 'ejú') ||
                endsWith(s, len, 'eme') ||
                endsWith(s, len, 'íte') ||
                endsWith(s, len, 'íme') ||
                endsWith(s, len, 'ými') ||//From cz
                endsWith(s, len, 'ymi') ||
                endsWith(s, len, 'ach') ||
                endsWith(s, len, 'iam') ||
                /*endsWith(s, len, "atá") ||*/
                endsWith(s, len, 'iac') ||
                endsWith(s, len, 'ite') ||
                endsWith(s, len, 'ili') ||
                endsWith(s, len, 'ila') ||
                endsWith(s, len, 'ilo') ||
                endsWith(s, len, 'ime') ||
                endsWith(s, len, 'och')
            )) {
            return len - 3;
        }

        if (len > 4 &&
            (       /*endsWith(s, len, "ín") ||*/
                endsWith(s, len, 'ím') ||//From cz
                endsWith(s, len, 'ám') ||//From cz
                endsWith(s, len, 'am') ||
                endsWith(s, len, 'us') ||//From cz
                endsWith(s, len, 'ým') ||//From cz
                endsWith(s, len, 'ym') ||
                endsWith(s, len, 'mi') ||//From cz
                endsWith(s, len, 'ou') ||//From cz
                endsWith(s, len, 'om') ||
                endsWith(s, len, 'ej') ||
                endsWith(s, len, 'ov') ||
                endsWith(s, len, 'ia') ||
                endsWith(s, len, 'ie') ||
                endsWith(s, len, 'iu') ||
                endsWith(s, len, 'im') ||
                endsWith(s, len, 'ho') ||
                endsWith(s, len, 'mu') ||
                endsWith(s, len, 'me') ||
                endsWith(s, len, 'te') ||
                endsWith(s, len, 'ať') ||
                endsWith(s, len, 'aš') ||
                endsWith(s, len, 'úť') ||
                endsWith(s, len, 'iť') ||
                endsWith(s, len, 'íš') ||
                endsWith(s, len, 'iš') ||
                endsWith(s, len, 'il') ||
                endsWith(s, len, 'úc') ||
                endsWith(s, len, 'eš'))) {
            return len - 2;
        }

        if (len > 3) {
            switch (s[len - 1]) {
                case 'a':
                case 'e':
                case 'i':
                case 'o':
                case 'u':
                case 'ú':
                /*case 'ô':*/
                case 'y':
                case 'á':
                case 'é':
                case 'í':
                case 'ý':
                    return len - 1;
            }
        }

        return len;
    }

    removePossessives(s, len) {
        if (len > 5 && (endsWith(s, len, 'in') ||
            endsWith(s, len, 'ov'))) {
            return len - 2;
        }

        return len;
    }

    normalize(s, len) {
        //toto pravidlo znižuje FP ale zvyšuje FN
        /*        if (len > 1 && s[len - 2] === 'i' && s[len-1]=='c') {
                    s = replaceChar(s, len - 2, [len - 1]); // e* > *
                    return len - 1;
                }*/
        switch (s[len - 1]) {
            case 'c': // [cč] -> k
            case 'č':
                s = replaceChar(s, len - 1, 'k');
                return {s, len};
            case 'ľ': // [ľ] -> l
                s = replaceChar(s, len - 1, 'l');
                return {s, len};
            case 'ň': // [ľ] -> l
                s = replaceChar(s, len - 1, 'n');
                return {s, len};
            case 'ť': // [ľ] -> l
                s = replaceChar(s, len - 1, 't');
                return {s, len};
        }

        if (len > 3 && s[len - 3] === 'i' && (s[len - 2] === 'e' || s[len - 2] === 'a' || s[len - 2] === 'u')) {
            s = replaceChar(s, len - 3, s[len - 2]);
            s = replaceChar(s, len - 2, s[len - 1]);
            return {s, len: len - 1};
        }

        return {s, len};
    }

    normalize2(s, len) {
        //Žiadny efekt
        /*if (len > 1 && s[len - 2] === 'z' && s[len - 2] === 'e' && s[len-1]=='ň') {
            replaceChar( s,len - 3, s[len - 1]); // zeň > ň
            return len - 2;
        }*/

        if (len > 3 && s[len - 2] === 'e') {
            s = replaceChar(s, len - 2, s[len - 1]); // e* > *
            return {s, len: len - 1};
        }
        //Trochu znižuje false negative a dosť zvyšuje false positive
        /*if (len > 3 && s[len - 2] === 'í') {
            replaceChar( s,len - 2, 'i'); // e* > *
            return {s, len};
        }*/

        if (len > 3 && s[len - 2] === 'o' && s[len - 1] === 'k') {
            s = replaceChar(s, len - 2, s[len - 1]); // e* > *
            return {s, len: len - 1};
        }
        if (len > 3 && s[len - 2] === 'o' && s[len - 1] === 'l') {
            s = replaceChar(s, len - 2, s[len - 1]); // e* > *
            return {s, len: len - 1};
        }

        return {s, len};
    }
};
