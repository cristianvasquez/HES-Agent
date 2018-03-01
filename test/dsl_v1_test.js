const expect = require("chai").expect;
const DSL_V1 = require("../server/dsl_v1");
const config = require("../config");
const path = require('path');
const Context = require("../server/Context");
const fs = require('fs-extra')

let dsl_v1 = new DSL_V1();
/**
 * Chai: https://devhints.io/chai
 */
// Globals
String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.split(search).join(replacement);
};

function getContextualizedDslV1(){
    let request = {
        headers:{
            host:'example.org'
        },
        originalUrl:'/'+config.serverOptions.appEntrypoint+'/some/url/there'
    };
    return new DSL_V1(new Context(request));
}

describe("toDereferenciable", function () {
    function before() {
        config.serverOptions.workSpacePath = __dirname;
    }

    // *  - An external URL, which expands to URL.

    it("Does leave an http url as the same", function () {
        before();
        let result = dsl_v1.toDereferenciable(config.serverOptions.workSpacePath,"http://www.example.org");
        expect(result).to.equal("http://www.example.org");
    });

    it("Does leave an https url as the same", function () {
        before();
        let result = dsl_v1.toDereferenciable(config.serverOptions.workSpacePath,"https://www.example.org");
        expect(result).to.equal("https://www.example.org");
    });

    it("A file (relative) expands to a file.", function () {
        before();
        let result = dsl_v1.toDereferenciable(config.serverOptions.workSpacePath,"./example/file_1.ttl");
        expect(result).to.equal(config.serverOptions.workSpacePath+"/example/file_1.ttl");
    });

    it("A file (absolute) expands to a file.", function () {
        before();
        let result = dsl_v1.toDereferenciable(config.serverOptions.workSpacePath,"/example/file_1.ttl");
        expect(result).to.equal(config.serverOptions.workSpacePath+"/example/file_1.ttl");
    });

    it("Fails with an invalid pointer", function () {
        before();
        expect(function () {
            dsl_v1.toDereferenciable(config.serverOptions.workSpacePath,"exotic test")
        }).to.throw("404 [exotic test]");
    });

    it("Fails with a file or directory that does not exist", function () {
        before();
        expect(function () {
            dsl_v1.toDereferenciable(config.serverOptions.workSpacePath,"/example/does_not_exist")
        }).to.throw("404 [/example/does_not_exist]");
    });

    it("A meta operation (relative) expands to an url.", function () {
        before();
        let result = getContextualizedDslV1().toDereferenciable(config.serverOptions.workSpacePath,"./example/exec");
        expect(result).to.equal('http://example.org/'+config.serverOptions.appEntrypoint+'/example/exec');
    });

    it("A meta operation (absolute) expands to an url.", function () {
        before();
        let result = getContextualizedDslV1().toDereferenciable(config.serverOptions.workSpacePath,"/example/exec");
        expect(result).to.equal('http://example.org/'+config.serverOptions.appEntrypoint+'/example/exec');
    });

});

describe("toDereferenciables", function () {
    function before() {
        config.serverOptions.workSpacePath = __dirname;
    }

    it("Does leave an http url as the same", function () {
        before();
        let result = dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"http://www.example.org");
        expect(result).to.deep.equal(["http://www.example.org"]);
    });

    it("Does leave an https url as the same", function () {
        before();
        let result = dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"https://www.example.org");
        expect(result).to.deep.equal(["https://www.example.org"]);
    });

    it("A file (relative) expands to a file.", function () {
        before();
        let result = dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"./example/file_1.ttl");
        expect(result).to.deep.equal([config.serverOptions.workSpacePath+"/example/file_1.ttl"]);
    });

    it("A file (absolute) expands to a file.", function () {
        before();
        let result = dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"/example/file_1.ttl");
        expect(result).to.deep.equal([config.serverOptions.workSpacePath+"/example/file_1.ttl"]);
    });

    it("Fails with an invalid pointer", function () {
        before();
        expect(function () {
            dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"exotic test")
        }).to.throw(Error);
    });

    it("Fails with a file or directory that does not exist", function () {
        before();
        expect(function () {
            dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"/example/does_not_exist")
        }).to.throw("404 ["+config.serverOptions.workSpacePath+"/example/does_not_exist]");
    });

    it("A directory (absolute) expands to files.", function () {
        before();
        let result = dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"/example");
        expect(result).to.deep.equal([
            config.serverOptions.workSpacePath+"/example/file_1.ttl",
            config.serverOptions.workSpacePath+"/example/file_2.ttl"
        ]);
    });

    it("A directory (relative) expands to files.", function () {
        before();
        let result = dsl_v1.toDereferenciables(config.serverOptions.workSpacePath,"./example");
        expect(result).to.deep.equal([
            config.serverOptions.workSpacePath+"/example/file_1.ttl",
            config.serverOptions.workSpacePath+"/example/file_2.ttl"
        ]);
    });

    it("A meta operation (relative) expands to an url.", function () {
        before();
        let result = getContextualizedDslV1().toDereferenciables(config.serverOptions.workSpacePath,"./example/exec");
        expect(result).to.deep.equal(['http://example.org/'+config.serverOptions.appEntrypoint+'/example/exec']);
    });

    it("A meta operation (absolute) expands to an url.", function () {
        before();
        let result = getContextualizedDslV1().toDereferenciables(config.serverOptions.workSpacePath,"/example/exec");
        expect(result).to.deep.equal(['http://example.org/'+config.serverOptions.appEntrypoint+'/example/exec']);
    });

});

describe("dsl-interpreter", function () {

    function before() {
        config.serverOptions.workSpacePath = path.resolve(__dirname + '/../workspace');
    }

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
            "hes:imports": {
                "hes:href": "/lib/whoIsWhat"
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

    it("example_05_maintains_content_type", function () {
        before();
        let input = {
            "hes:name": "extend",
            "hes:Content-Type": "text/turtle",
            "hes:description": "extend /lib",
            "hes:imports": {
                "hes:href": "/lib/whoIsWhat"
            }
        };

        let expanded = {
            "hes:name": "extend",
            "hes:Content-Type": "text/turtle",
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

    it("example_05_maintains_content_type_for_href", function () {
        before();
        let input = {
            "hes:name": "next",
            "hes:Content-Type": "text/turtle",
            "hes:imports": {
                "hes:href": "/example_01/next"
            }
        };

        let expanded = {
            "hes:name": "next",
            "hes:Content-Type": "text/turtle",
            "hes:description": "go to example 2",
            "hes:href": config.serverOptions.workSpacePath+"/example_02"
        };
        let result = dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_05'),input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_06", function () {
        before();
        let input = {
            "hes:name": "alice",
            "hes:description": "Alice's space",
            "hes:imports": {
                "hes:href": "/lib/whoIsWhat",
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

    it("example_06_add", function () {
        before();
        let input = {
            "hes:name": "alice_2",
            "hes:description": "Adds alice's space",
            "hes:imports": {
                "hes:href": "/lib/whoIsWhat",
                "hes:addData": {
                    "hes:href": "./personal"
                }
            }
        };
        let expanded = {
            "hes:name": "alice_2",
            "hes:description": "Adds alice's space",
            "hes:inference": {
                "hes:data": {
                    "hes:href": [
                        config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
                        config.serverOptions.workSpacePath+"/lib/data/socrates.n3",
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
            "hes:imports": {
                "hes:href": "/lib/whoIsWhat",
                "hes:data": {
                    "hes:href": "../../test/example"
                }
            }
        };

        expect(function () {
            dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_06'),input);
        }).to.throw("403 ["+path.join(config.serverOptions.workSpacePath,"../test/example")+"]");
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

    describe("Interprets border cases", function () {

        it("circular", function () {
            config.serverOptions.workSpacePath = path.resolve(__dirname);

            let input = {
                "hes:name": "exec",
                "hes:imports": {
                    "hes:href": "/circular_02/exec"
                }
            };

            expect(function () {
                dsl_v1.expandMeta(path.resolve(__dirname + '/../workspace/example_01'),input)
            }).to.throw("Maximum call stack size exceeded");

        });

    });

});

/**
 * Should change to simply check against json schema when dsl is stable.
 */
describe("validator", function () {

    function before() {
        config.serverOptions.workSpacePath = path.resolve(__dirname + '/../workspace');
    }

    it("all_examples", function () {

        /**
         * Walk recursively through josd's fluid
         */
        const walkSync = (d) => {
            if (fs.statSync(d).isDirectory()) {
                return fs.readdirSync(d).map(f => walkSync(path.join(d, f)))
            } else {
                if (d.endsWith(config.serverOptions.indexFile)) {
                    validate(d);
                }
                return undefined
            }
        };
        function validate(indexFile){
            console.log(indexFile);
            let contents = fs.readFileSync(indexFile);
            let index = JSON.parse(contents);
            if (index['hes:meta']){
                for (let operation of index['hes:meta']){
                    console.log('\t'+operation['hes:name']);
                    expect(DSL_V1.validateOperation(operation)).to.equal(true);
                }
            }
        }
        walkSync(config.serverOptions.workSpacePath);
    });

    it("example_1", function () {
        before();
        let input = {
            "hes:name": "next",
            "hes:description": "go to example 2",
            "hes:href": "../example_02"
        };
        let result = DSL_V1.validateOperation(input);
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

        let result = DSL_V1.validateOperation(input);
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
        let result = DSL_V1.validateOperation(input);
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
        let result = DSL_V1.validateOperation(input);
        expect(result).to.equal(false);
    });

    it("example_5", function () {
        before();

        let input = {
            "hes:name": "extend",
            "hes:description": "extend /lib",
            "hes:imports": {
                "hes:href": "/lib",
                "hes:name": "whoIsWhat"
            }
        };

        let result = DSL_V1.validateOperation(input);
        expect(result).to.equal(true);
    });

    it("example_6", function () {
        before();

        let input = {
            "hes:name": "alice",
            "hes:description": "Alice's space",
            "hes:imports": {
                "hes:href": "/lib",
                "hes:name": "whoIsWhat",
                "hes:data": [
                    {
                        "hes:href": "./personal"
                    }
                ]
            }
        };
        let result = DSL_V1.validateOperation(input);
        expect(result).to.equal(false);
    });

});

describe("dependency graphs", function () {

    function before() {
        config.serverOptions.workSpacePath = path.resolve(__dirname + '/../workspace');
    }

    it("all examples", function () {
        let dependencyGraph =   dsl_v1.buildLocalDependencyGraph(config.serverOptions.workSpacePath);
        console.log(dependencyGraph);
    });

});


describe("validatorCrud", function () {

    function before() {
        config.serverOptions.workSpacePath = path.resolve(__dirname + '/../workspace');
    }

    it("create import", function () {
        before();
        let input = {
            "hes:imports": {
                "@id":"http://localhost:3000/some_path/agent/operation_name",
                "hes:Content-Type":"application/x-json+ld",
                "hes:addData": {
                    "hes:href": ["../user_profile","../environment","../other_rule"]
                }
            }
        };
        let result = DSL_V1.validateCrudOperation(input);
        expect(result).to.equal(true);
    });

});

describe("toAbsolutePath", function () {

    function before() {
        config.serverOptions.workSpacePath = __dirname;
    }

    describe("toAbsolutePath, basic functionality", function () {

        it("Respects absolute path inside the workspace", function () {
            before();
            let result = DSL_V1.toAbsolutePath(config.serverOptions.workSpacePath+"/inside_1","/inside_2");
            expect(result).to.equal(config.serverOptions.workSpacePath+"/inside_2");
        });

        it("Respects relative path inside the workspace", function () {
            before();
            let result = DSL_V1.toAbsolutePath(config.serverOptions.workSpacePath+"/inside_1","../inside_2");
            expect(result).to.equal(config.serverOptions.workSpacePath+"/inside_2");
        });

        it("Don't handle relative outside workspace", function () {
            before();
            expect(function () {
                DSL_V1.toAbsolutePath(config.serverOptions.workSpacePath+"/inside","../../inside_2")
            }).to.throw("403 ["+path.join(config.serverOptions.workSpacePath+"/inside","../../inside_2")+"]");

        });

    });
});
