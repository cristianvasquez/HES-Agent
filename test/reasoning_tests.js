var expect = require("chai").expect;
var reasoning = require("../server/reasoning");
var config = require("../config");

/**
 * Chai: https://devhints.io/chai
 */
// Globals
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

describe("eyeOptions", function () {

    function before() {
        // config.serverOptions.workSpacePath = __dirname;
    }

    it("Does not contain nope", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href": [
                    config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                    config.serverOptions.workSpacePath+"/lib/data/socrates.n3"
                ]
            },
            "hes:query": {
                "hes:href": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
            },
            "hes:options":{
                "hes:proof":true
            }
        };
        let command = reasoning.getEyeCommand(inference);

        expect(command).to.not.contain("--nope");
    });

    it("Does contain nope", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href": [
                    config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                    config.serverOptions.workSpacePath+"/lib/data/socrates.n3"
                ]
            },
            "hes:query": {
                "hes:href": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
            }
        };
        let command = reasoning.getEyeCommand(inference);

        expect(command).to.contain("--nope");
    });

    it("Does handle one data entry", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href": "data.n3"
            },
            "hes:query": {
                "hes:href": "query.n3"
            }
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope data.n3 --query query.n3");
    });

    it("Does handle two data entries", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href": ["data_01.n3","data_02.n3"]
            },
            "hes:query": {
                "hes:href": "query.n3"
            }
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope data_01.n3 data_02.n3 --query query.n3");
    });

    it("Does handle array with one query", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href": "data.n3"
            },
            "hes:query": {
                "hes:href": ["query.n3"]
            }
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope data.n3 --query query.n3");
    });

    it("Fails with an array with two queries", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href": "data.n3"
            },
            "hes:query": {
                "hes:href": ["query_01.n3","query_02.n3"]
            }
        };

        expect(function () {
            reasoning.getEyeCommand(inference)
        }).to.throw("cannot handle multiple queries");

    });


    it("Does handle --strings", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href": "data.n3"
            },
            "hes:query": {
                "hes:href": "query.csvq"
            },
            "eye:flags": [
                "--strings"
            ],
            "hes:Accept": "application/CSV"
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope --strings data.n3 --query query.csvq");
    });

    it("Does include proof", function () {
        before();

        let inference =    {
            "hes:data": {
                "hes:href":["./agent2-map.n3","../lib/gps-plugin.n3"]
            },
            "hes:proof": {
                "hes:href":["http://alice/alice_proof"]
            },
            "hes:query":{
                "hes:href": "./agent2-query.n3"
            }
        };
        let command = reasoning.getEyeCommand(inference);

        expect(command).to.contain("--proof http://alice/alice_proof");
    });

    it("Does include two proofs", function () {
        before();

        let inference =    {
            "hes:data": {
                "hes:href":["./agent2-map.n3","../lib/gps-plugin.n3"]
            },
            "hes:proof": {
                "hes:href":["http://alice/alice_proof","http://bob/bob_proof"]
            },
            "hes:query":{
                "hes:href": "./agent2-query.n3"
            }
        };
        let command = reasoning.getEyeCommand(inference);

        expect(command).to.contain("--proof http://alice/alice_proof");
        expect(command).to.contain("--proof http://bob/bob_proof");

    });

    it("Fails with proof without href", function () {
        before();

        let inference = {
            "hes:data": {
                "hes:href":["./agent2-map.n3","../lib/gps-plugin.n3"]
            },
            "hes:proof": {},
            "hes:query":{
                "hes:href": "./agent2-query.n3"
            }
        };

        expect(function () {
            reasoning.getEyeCommand(inference)
        }).to.throw("hes:href for proof not specified");

    });

});

