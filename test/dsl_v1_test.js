var expect = require("chai").expect;
var dsl_v1 = require("../server/dsl_v1");
var config = require("../config");
var path = require('path');

/**
 * Chai: https://devhints.io/chai
 */
// Globals
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

describe("expandDirectories", function () {

    function before() {
        config.serverOptions.workSpacePath = __dirname;
    }

    describe("expandDirectories: gets a file or multiple files", function () {

        it("Does leave an http url as the same", function () {
            before();
            let result = dsl_v1.expandDirectories("http://www.example.org");
            expect(result).to.deep.equal(["http://www.example.org"]);
        });

        it("Does leave an https url as the same", function () {
            before();
            let result = dsl_v1.expandDirectories("https://www.example.org");
            expect(result).to.deep.equal(["https://www.example.org"]);
        });

        it("Fails with an invalid pointer", function () {
            before();
            expect(function () {
                dsl_v1.expandDirectories("exotic test")
            }).to.throw("404 [exotic test]");
        });

        it("Fails with a file or directory that does not exist", function () {
            before();
            expect(function () {
                dsl_v1.expandDirectories("/example/does_not_exist")
            }).to.throw("404 [/example/does_not_exist]");
        });

    });
});


describe("pre-processing", function () {

    function before() {
        config.serverOptions.workSpacePath = path.resolve(__dirname + '/../workspace');
    }

    describe("Interprets the example operations", function () {

        it("example_01", function () {
            before();
            let input = {
                "hes:name": "next",
                "hes:description": "go to example 2",
                "hes:href": "../example_02"
            };
            let expanded = {
                "hes:name": "next",
                "hes:description": "go to example 2",
                "hes:href": config.serverOptions.workSpacePath+"/example_02"
            };
            let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_01'),input);
            expect(result).to.deep.equal(expanded);
        });

        it("example_02", function () {
            before();
            let input = {
                "hes:name": "dbpedia",
                "hes:description": "Dbpedia query",
                "hes:query": {
                    "hes:endpoint": "http://dbpedia.restdesc.org",
                    "hes:default-graph-uri": "http://dbpedia.org",
                    "hes:raw": "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } limit 10",
                    "hes:Accept": "application/x-json+ld"
                }
            };
            let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_02'),input);
            expect(result).to.deep.equal(input);
        });

        it("example_03", function () {
            before();
            let input = {
                "hes:name": "socrates",
                "hes:description": "Socrates example",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": "/lib/data"
                    },
                    "hes:query": {
                        "hes:raw": "{ ?who a ?what } => { ?who a ?what }."
                    }
                }
            };
            let expanded = {
                "hes:name": "socrates",
                "hes:description": "Socrates example",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": [
                            config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                            config.serverOptions.workSpacePath+"/lib/data/socrates.n3"
                        ]
                    },
                    "hes:query": {
                        "hes:raw": "{ ?who a ?what } => { ?who a ?what }."
                    }
                }
            };
            let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_03'),input);
            expect(result).to.deep.equal(expanded);
        });

        it("example_04", function () {
            before();
            let input = {
                "hes:name": "bob",
                "hes:description": "Bob space",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": ["/lib/data/knowledge.n3", "./personal"]
                    },
                    "hes:query": {
                        "hes:href": "/lib/query/whoIsWhat.n3"
                    }
                }
            };
            let expanded = {
                "hes:name": "bob",
                "hes:description": "Bob space",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": [
                            config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                            config.serverOptions.workSpacePath+"/example_04/personal/Bob.n3"
                        ]
                    },
                    "hes:query": {
                        "hes:href": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
                    }
                }
            };
            let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_04'),input);
            expect(result).to.deep.equal(expanded);
        });

        it("example_05", function () {
            before();
            let input = {
                "hes:name": "extend",
                "hes:description": "extend /lib",
                "hes:extends": {
                    "hes:href": "/lib",
                    "hes:name": "whoIsWhat"
                }
            };

            let expanded = {
                "hes:name": "extend",
                "hes:description": "extend /lib",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": [
                            config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                            config.serverOptions.workSpacePath+"/lib/data/socrates.n3"
                        ]
                    },
                    "hes:query": {
                        "hes:href": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
                    }
                }
            };
            let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_05'),input);
            expect(result).to.deep.equal(expanded);
        });

        it("example_06", function () {
            before();
            let input = {
                "hes:name": "alice",
                "hes:description": "Alice's space",
                "hes:extends": {
                    "hes:href": "/lib",
                    "hes:name": "whoIsWhat",
                    "hes:data": {
                        "hes:href": "./personal"
                    }
                }
            };
            let expanded = {
                "hes:name": "alice",
                "hes:description": "Alice's space",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": [
                            config.serverOptions.workSpacePath+"/example_06/personal/Alice.n3",
                            config.serverOptions.workSpacePath+"/example_06/personal/knowledge.n3"
                        ]
                    },
                    "hes:query": {
                        "hes:href": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
                    }
                }
            };
            let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_06'),input);
            expect(result).to.deep.equal(expanded);
        });

    });


    describe("validator", function () {

        function before() {
            config.serverOptions.workSpacePath = path.resolve(__dirname + '/../workspace');
        }

        describe("Validates the example operations", function () {

            it("example_1", function () {
                before();
                let input = {
                    "hes:name": "next",
                    "hes:description": "go to example 2",
                    "hes:href": "../example_02"
                };
                let result = dsl_v1.validateMeta(input);
                expect(result).to.equal(true);
            });

            it("example_2", function () {
                before();

                let input = {
                    "hes:name": "dbpedia",
                    "hes:description": "Dbpedia query",
                    "hes:query": {
                        "hes:endpoint": "http://dbpedia.restdesc.org",
                        "hes:default-graph-uri": "http://dbpedia.org",
                        "hes:raw": "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } limit 10",
                        "hes:Accept": "application/x-json+ld"
                    }
                };

                let result = dsl_v1.validateMeta(input);
                expect(result).to.equal(true);
            });

            it("example_3", function () {
                before();
                let input = {
                    "hes:name": "socrates",
                    "hes:description": "Socrates example",
                    "hes:inference": {
                        "hes:data": [
                            {
                                "hes:href": "/lib/data"
                            }
                        ],
                        "hes:query": {
                            "hes:raw": "{ ?who a ?what } => { ?who a ?what }."
                        }
                    }
                };
                let result = dsl_v1.validateMeta(input);
                expect(result).to.equal(false);
            });

            it("example_4", function () {
                before();

                let input = {
                    "hes:name": "bob",
                    "hes:description": "Bob space",
                    "hes:inference": {
                        "hes:data": [
                            {
                                "hes:href": "/lib/data/knowledge.n3"
                            },
                            {
                                "hes:href": "./personal"
                            }
                        ],
                        "hes:query": {
                            "hes:href": "/lib/query/whoIsWhat.n3"
                        }
                    }
                };
                let result = dsl_v1.validateMeta(input);
                expect(result).to.equal(false);
            });

            it("example_5", function () {
                before();

                let input = {
                    "hes:name": "extend",
                    "hes:description": "extend /lib",
                    "hes:extends": {
                        "hes:href": "/lib",
                        "hes:name": "whoIsWhat"
                    }
                };

                let result = dsl_v1.validateMeta(input);
                expect(result).to.equal(true);
            });

            it("example_6", function () {
                before();

                let input = {
                    "hes:name": "alice",
                    "hes:description": "Alice's space",
                    "hes:extends": {
                        "hes:href": "/lib",
                        "hes:name": "whoIsWhat",
                        "hes:data": [
                            {
                                "hes:href": "./personal"
                            }
                        ]
                    }
                };
                let result = dsl_v1.validateMeta(input);
                expect(result).to.equal(false);
            });

        });

    });
});