var expect    = require("chai").expect;
var resolve = require("../server/resolve");
var config = require("../config");

/**
 * Chai: https://devhints.io/chai
 */

// Globals
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

config.workSpacePath = __dirname;

describe("Resolve utils", function() {
    describe("specToPublic: converts a path specification to a set of uris to feed the reasoner", function() {
        it("Converts pointer to file to a local file", function() {
            let result = resolve.specToPublic(__dirname, "file://resources/example/file_1.ttl");
            expect(result).to.deep.equal([__dirname+"/example/file_1.ttl"]);
        });

        it("Converts pointer to container to local files", function() {
            let result = resolve.specToPublic(__dirname, "file://resources/example");
            expect(result).to.deep.equal(
                [__dirname+"/example/file_1.ttl",__dirname+"/example/file_2.ttl"]
            );
        });

        it("Does leave an url as the same", function() {
            let result = resolve.specToPublic(__dirname, "http://www.example.org");
            expect(result).to.deep.equal(["http://www.example.org"]);
        });

        it("Does leave an url as the same", function() {
            let result = resolve.specToPublic(__dirname, "https://www.example.org");
            expect(result).to.deep.equal(["https://www.example.org"]);
        });

        it("Fails with an invalid pointer", function() {
            expect(function(){
                resolve.specToPublic(__dirname, "exotic test")
            }).to.throw('exotic test not recognized');
        });

        it("Fails with a file or directory that does not exist", function() {
            expect(function(){
                resolve.specToPublic(__dirname, "file://resources/example/does_not_exist")
            }).to.throw("404 ["+__dirname+"/example/does_not_exist]");
        });
    });
});