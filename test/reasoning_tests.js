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

    describe("expands eye options as required", function () {

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
    //
    // it("example_06", function () {
    //     before();
    //
    //     let inference = {
    //         "hes:data": {
    //             "hes:href": [
    //                 config.serverOptions.workSpacePath+"/example_06/personal/Alice.n3",
    //                 config.serverOptions.workSpacePath+"/example_06/personal/knowledge.n3"
    //             ]
    //         },
    //         "hes:query": {
    //             "hes:href": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
    //         }
    //     };
    //
    //     let command = reasoning.getEyeCommand(inference);
    //
    //     expect(command).to.contain("--nope "+config.serverOptions.workSpacePath+"/example_06/personal/Alice.n3 "+config.serverOptions.workSpacePath+"/workspace/example_06/personal/knowledge.n3 --query "+config.serverOptions.workSpacePath+"/workspace/lib/query/whoIsWhat.n3");
    // });
    //



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

});

