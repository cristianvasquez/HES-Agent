const expect = require("chai").expect;
const reasoning = require("../server/reasoning");
const config = require("../config");

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

    it("Does contain nope", function () {
        before();

        let inference = {
            "data": [
                config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                config.serverOptions.workSpacePath+"/lib/data/socrates.n3"
            ],
            "query": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
        };
        let command = reasoning.getEyeCommand(inference);

        expect(command).to.contain("--nope");
    });

    it("Does handle one data entry", function () {
        before();

        let inference = {
            "data":"data.n3",
            "query": "query.n3"
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope data.n3 --query query.n3");
    });

    it("Does handle two data entries", function () {
        before();

        let inference = {
            "data": ["data_01.n3","data_02.n3"],
            "query": "query.n3"
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope data_01.n3 data_02.n3 --query query.n3");
    });

    it("Does handle array with one query", function () {
        before();

        let inference = {
            "data": "data.n3",
            "query": ["query.n3"]
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope data.n3 --query query.n3");
    });

    it("Fails with an array with two queries", function () {
        before();

        let inference = {
            "data": "data.n3",
            "query": ["query_01.n3","query_02.n3"]
        };

        expect(function () {
            reasoning.getEyeCommand(inference)
        }).to.throw("cannot handle multiple queries");

    });


    it("Does handle --strings", function () {
        before();

        let inference = {
            "data": "data.n3",
            "query": "query.csvq",
            "eye:flags": [
                "--strings"
            ],
            "Accept": "application/CSV"
        };

        let command = reasoning.getEyeCommand(inference);
        expect(command).to.contain("--nope --strings data.n3 --query query.csvq");
    });

    it("Does include proof", function () {
        before();

        let inference =    {
            "data": ["./agent2-map.n3","../lib/gps-plugin.n3"],
            "proof": ["http://alice/alice_proof"],
            "query":"./agent2-query.n3"
        };
        let command = reasoning.getEyeCommand(inference);

        expect(command).to.contain("--proof http://alice/alice_proof");
    });

    it("Does include two proofs", function () {
        before();

        let inference =    {
            "data": ["./agent2-map.n3","../lib/gps-plugin.n3"],
            "proof": ["http://alice/alice_proof","http://bob/bob_proof"],
            "query":"./agent2-query.n3"
        };
        let command = reasoning.getEyeCommand(inference);

        expect(command).to.contain("--proof http://alice/alice_proof");
        expect(command).to.contain("--proof http://bob/bob_proof");

    });

});

describe("detectErrors", function () {

    // TODO: mock eye server
    // it("Detects an error", function () {
    //     let command = "/opt/eye/bin/eye.sh --nope http://localhost:3000/dataspaces/irail schedule --query http://localhost:3000/resource/tmp/1512436968.ttl"
    //     reasoning.invokeEye(command,false).then(function (result) {
    //         expect("Cannot").to.equal("Succeed");
    //     }).catch(function (error) {
    //
    //     });
    // });

});

