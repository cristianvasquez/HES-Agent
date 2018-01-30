var expect = require("chai").expect;
var dsl_v1 = require("../server/dsl_v1");
var config = require("../config");

/**
 * Chai: https://devhints.io/chai
 */

// Globals
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

config.serverOptions.workSpacePath = __dirname;

describe("Basic functions", function () {

    describe("specToPublic: converts an href specific to a set of uris to feed the reasoner", function () {

        it("Converts pointer to file to a local file", function () {
            let result = dsl_v1.specToPublic(__dirname, "file:///example/file_1.ttl");
            expect(result).to.deep.equal([__dirname + "/example/file_1.ttl"]);
        });

        it("Converts pointer to container to local files", function () {
            let result = dsl_v1.specToPublic(__dirname, "file:///example");
            expect(result).to.deep.equal(
                [__dirname + "/example/file_1.ttl", __dirname + "/example/file_2.ttl"]
            );
        });

        it("Does leave an http url as the same", function () {
            let result = dsl_v1.specToPublic(__dirname, "http://www.example.org");
            expect(result).to.deep.equal(["http://www.example.org"]);
        });

        it("Does leave an https url as the same", function () {
            let result = dsl_v1.specToPublic(__dirname, "https://www.example.org");
            expect(result).to.deep.equal(["https://www.example.org"]);
        });

        it("Fails with an invalid pointer", function () {
            expect(function () {
                dsl_v1.specToPublic(__dirname, "exotic test")
            }).to.throw("I don't know how to handle href exotic test");
        });

        it("Fails with a file or directory that does not exist", function () {
            expect(function () {
                dsl_v1.specToPublic(__dirname, "file:///example/does_not_exist")
            }).to.throw("404 [" + __dirname + "/example/does_not_exist]");
        });

    });
});