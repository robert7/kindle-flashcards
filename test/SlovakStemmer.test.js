// https://mochajs.org/
// assertions: https://mochajs.org/#assertions

const {SlovakStemmer, endsWith, startsWith, deleteN, replaceChar} = require('../src/SlovakStemmer');

// chai & sinon: https://scotch.io/tutorials/how-to-test-nodejs-apps-using-mocha-chai-and-sinonjs
const chai = require('chai');
const expect = chai.expect;

var assert = require('assert');
describe('SlovakStemmer', function() {
    describe('startsWith', function() {
        it('should return false if has prefix, but longer then buffer', function() {
            assert(!startsWith('abcd', 2, 'abc'));
            assert(!startsWith('abcd', 1, 'abc'));
        });
        it('should return true if has prefix', function() {
            const word = 'abcd';
            assert(startsWith(word, 4, 'ab'));
            assert(startsWith(word, 4, 'abc'));
            assert(startsWith(word, 4, 'abcd'));
            assert(startsWith(word, 3, 'ab'));
            assert(startsWith(word, 2, 'ab'));
        });
        it('should return false if it hasn\'t prefix', function() {
            const word = 'abcd';
            assert(!startsWith(word, 4, 'ba'));
            assert(!startsWith(word, 3, 'ba'));
            assert(!startsWith(word, 2, 'ba'));
        });
    });

    describe('endsWith', function() {
        it('should return false if has suffix, but longer then buffer', function() {
            assert(!endsWith('abcd', 2, 'bcd'));
            assert(!endsWith('abcd', 1, 'cd'));
        });
        it('should return true if has suffix', function() {
            const word = 'abcd';
            assert(endsWith(word, 4, 'cd'));
            assert(endsWith(word, 4, 'bcd'));
            assert(endsWith(word, 4, 'abcd'));
            assert(endsWith(word, 3, 'bc'));
            assert(endsWith(word, 2, 'ab'));
        });
        it('should return false if it hasn\'t suffix', function() {
            const word = 'abcd';
            assert(!endsWith(word, 4, 'ba'));
            assert(!endsWith(word, 3, 'ba'));
            assert(!endsWith(word, 2, 'ba'));
        });
    });

    describe('deleteN', function() {
        it('should correctly delete characters', function() {
            let t1 = deleteN('abcd', 0, 4, 2);
            assert(t1.s === 'cd' && t1.len === 2);

            t1 = deleteN('abcd', 1, 4, 2);
            assert(t1.s === 'ad' && t1.len === 2);

            t1 = deleteN('abcd', 2, 4, 2);
            assert(t1.s === 'ab' && t1.len === 2);
        });
    });

    describe('replaceChar', function() {
        it('should correctly replace characters', function() {
            assert(replaceChar('abcde', 0, 'A') === 'Abcde');
            assert(replaceChar('abcde', 1, 'A') === 'aAcde');
            assert(replaceChar('abcde', 4, 'A') === 'abcdA');
        });
    });

    describe('SlovakStemmer', function() {
        it('should correctly stem', function() {
            let slovakStemmer = new SlovakStemmer();

            expect(slovakStemmer.stem('najžľaznatejšieho')).to.be.equal('žľaznat');
            expect(slovakStemmer.stem('zefektívnenie')).to.be.equal('zefektívnn');
            expect(slovakStemmer.stem('umožnenie')).to.be.equal('umožnn');
        });
    });

});

