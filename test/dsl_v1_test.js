const expect = require("chai").expect;
const dsl_v1 = require("../server/dsl_v1");
const config = require("../config");
const path = require('path');

/**
 * Chai: https://devhints.io/chai
 */
// Globals
String.prototype.replaceAll = function (search, replacement) {
    let target = this;
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

        it("example_06_when_outside_directory", function () {
            before();
            let input = {
                "hes:name": "alice",
                "hes:description": "Alice's space",
                "hes:extends": {
                    "hes:href": "/lib",
                    "hes:name": "whoIsWhat",
                    "hes:data": {
                        "hes:href": "../../test/example"
                    }
                }
            };
            let expanded = {
                "hes:name": "alice",
                "hes:description": "Alice's space",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": [
                            __dirname+"/example/file_1.ttl",
                            __dirname+"/example/file_2.ttl"
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

        it("example_07", function () {
            before();
            let input =      {
                "hes:name": "socrates",
                "hes:description": "Socrates proof",
                "hes:inference": {
                    "hes:data": {
                        "hes:href": "/lib/data"
                    },
                    "hes:query": {
                        "hes:raw": "{ ?who a ?what } => { ?who a ?what }."
                    },
                    "hes:options":{
                        "hes:proof":true
                    }
                }
            };

            let inference = {
                "hes:data": {
                    "hes:href": [
                        config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                        config.serverOptions.workSpacePath+"/lib/data/socrates.n3"
                    ]
                },
                "hes:query": {
                    "hes:raw": "{ ?who a ?what } => { ?who a ?what }."
                },
                "hes:options":{
                    "hes:proof":true
                }
            };

            let expanded = {
                "hes:name": "socrates",
                "hes:description": "Socrates proof",
                "hes:inference": inference
            };

            let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_07'),input);
            expect(result).to.deep.equal(expanded);
        });

    });


    describe("Interprets border cases", function () {

        it("circular", function () {
            config.serverOptions.workSpacePath = path.resolve(__dirname);

            let input = {
                "hes:name": "exec",
                "hes:extends": {
                    "hes:href": "/circular_02",
                    "hes:name": "exec"
                }
            };

            expect(function () {
                dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_01'),input)
            }).to.throw("Maximum call stack size exceeded");

        });


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

describe("normalizeHref", function () {

    function before() {
        config.serverOptions.workSpacePath = __dirname;
    }

    describe("Normalize Href, basic functionality", function () {

        it("Handles absolute path inside the workspace", function () {
            before();
            config.serverOptions.allowServeOutsideWorkspace=true;
            let result = dsl_v1.normalizeHref(config.serverOptions.workSpacePath+"/inside_1",config.serverOptions.workSpacePath+"/inside_2");
            expect(result).to.equal(config.serverOptions.workSpacePath+"/inside_2");
        });

        it("Handles outside workspace when allowed", function () {
            before();
            config.serverOptions.allowServeOutsideWorkspace=true;
            let result = dsl_v1.normalizeHref(config.serverOptions.workSpacePath+"/inside","../../workspace");
            expect(result).to.equal(path.join(__dirname,"../workspace"));
        });

        it("Don't handle outside workspace when not allowed", function () {
            before();
            config.serverOptions.allowServeOutsideWorkspace=false;
            expect(function () {
                dsl_v1.normalizeHref(config.serverOptions.workSpacePath+"/inside","/outsideDirectory")
            }).to.throw("I don't know how to handle href: /outsideDirectory");
        });



    });
});
