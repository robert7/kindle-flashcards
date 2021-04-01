const
    chai = require('chai'),
    sinon = require('sinon'),
    {concatMp3Files} = require('../src/mp3Util');
const expect = chai.expect;
// expect for promises
//chai.use(require('chai-as-promised'));

describe('mp3Util', function() {
    describe('setup', function() {
        it('check equality', function() {
            expect(true).to.be.true;
        });

        it('do simple concat', async function() {
            let internals = {
                // setup callbacks with spies
                concatMp3FilesInt: function() {
                    throw 'will not be called';
                },
                unlinkIfExists: sinon.spy(),
                chunkSize: 3
            };

            // Stub isLoggedIn function and make it return false always
            const concatMp3FilesIntStub = sinon.stub(internals, 'concatMp3FilesInt').returns(true);
            const mp3Parts = ['a.mp3', 'b.mp3'];
            const mp3Result = 'c.mp3';
            const result = await concatMp3Files(mp3Parts, mp3Result, internals);
            expect(result).to.be.true;

            expect(concatMp3FilesIntStub.calledOnce).to.be.true;
            expect(concatMp3FilesIntStub.firstCall.args[0]).to.deep.equal(mp3Parts);
            expect(concatMp3FilesIntStub.firstCall.args[1]).to.equal(mp3Result);
            expect(internals.unlinkIfExists.notCalled).to.be.true;
        });

        it('do simple concat (chunk size+2)', async function() {
            let internals = {
                // setup callbacks with spies
                concatMp3FilesInt: function() {
                    throw 'will not be called';
                },
                unlinkIfExists: sinon.spy(),
                chunkSize: 3
            };

            const concatMp3FilesIntStub = sinon.stub(internals, 'concatMp3FilesInt').returns(true);
            const mp3Parts = ['a.mp3', 'b.mp3', 'c.mp3', 'd.mp3', 'e.mp3'];
            const mp3Result = 'f.mp3';

            const result = await concatMp3Files(mp3Parts, mp3Result, internals);
            expect(result).to.be.true;

            expect(concatMp3FilesIntStub.calledOnce).to.be.true;

            expect(concatMp3FilesIntStub.firstCall.args[0]).to.deep.equal(mp3Parts);
            expect(concatMp3FilesIntStub.firstCall.args[1]).to.equal(mp3Result);
            expect(internals.unlinkIfExists.notCalled).to.be.true;
        });

        it('do 2 stage concat', async function() {
            let internals = {
                // setup callbacks with spies
                concatMp3FilesInt: function() {
                    throw 'will not be called';
                },
                unlinkIfExists: sinon.spy(),
                chunkSize: 3
            };

            // Stub isLoggedIn function and make it return false always
            const concatMp3FilesIntStub = sinon.stub(internals, 'concatMp3FilesInt').returns(true);

            const mp3Parts = ['a.mp3', 'b.mp3', 'c.mp3', 'd.mp3', 'e.mp3', 'f.mp3'];
            const mp3Result = 'res.mp3';
            const result = await concatMp3Files(mp3Parts, mp3Result, internals);
            expect(result).to.be.true;
            expect(concatMp3FilesIntStub.callCount).to.equal(2);

            expect(concatMp3FilesIntStub.firstCall.args[0]).to.deep.equal(['a.mp3', 'b.mp3', 'c.mp3']);
            const tmpFile = 'tmp-1.mp3';
            expect(concatMp3FilesIntStub.firstCall.args[1]).to.equal(tmpFile);

            expect(concatMp3FilesIntStub.secondCall.args[0]).to.deep.equal([tmpFile, 'd.mp3', 'e.mp3', 'f.mp3']);
            expect(concatMp3FilesIntStub.secondCall.args[1]).to.equal(mp3Result);

            expect(internals.unlinkIfExists.callCount).to.equal(1);
        });

    });
});