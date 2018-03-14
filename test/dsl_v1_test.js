const expect = require("chai").expect;
const DSL_V1 = require("../server/dsl_v1");
const path = require('path');
const Context = require("../server/Context");
const fs = require('fs-extra')

/**
 * Chai: https://devhints.io/chai
 */

// Globals
String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.split(search).join(replacement);
};

const defaultServerOptions = require("../config").serverOptions;
let baseUrl = 'http://example.org/dataspaces';
let request = {
    headers: {
        host: "example.org"
    },
    originalUrl: '/' + defaultServerOptions.appEntrypoint + "/some/url/there"
};


function getServerOptions(workSpacePath) {
    let serverOptions = JSON.parse(JSON.stringify(defaultServerOptions));
    serverOptions.workSpacePath = workSpacePath;
    return serverOptions;
}

function getDslWithContext(workSpacePath) {
    let serverOptions = getServerOptions(workSpacePath);
    let context = new Context(request, serverOptions);
    return new DSL_V1(context);
}

describe("toDereferenciable", function () {
    let workSpacePath = path.join(__dirname, 'workspace_01');
    let dsl_v1 = getDslWithContext(workSpacePath);
    dsl_v1.buildLocalDependencyGraph(workSpacePath);

    // *  - An external URL, which expands to URL.

    it("Does leave an http url as the same", function () {
        let result = dsl_v1.toDereferenciable(workSpacePath, "http://www.example.org");
        expect(result).to.equal("http://www.example.org");
    });

    it("Does leave an https url as the same", function () {
        let result = dsl_v1.toDereferenciable(workSpacePath, "https://www.example.org");
        expect(result).to.equal("https://www.example.org");
    });

    it("A file (relative) expands to a file.", function () {
        let result = dsl_v1.toDereferenciable(workSpacePath, "./example/files/file_1.ttl");
        expect(result).to.equal(workSpacePath + "/example/files/file_1.ttl");
    });

    it("A file (absolute) expands to a file.", function () {
        let result = dsl_v1.toDereferenciable(workSpacePath, "/example/files/file_1.ttl");
        expect(result).to.equal(workSpacePath + "/example/files/file_1.ttl");
    });

    it("Fails with an invalid pointer", function () {
        expect(function () {
            dsl_v1.toDereferenciable(workSpacePath, "exotic test")
        }).to.throw("404 [exotic test]");
    });

    it("Fails with a file or directory that does not exist", function () {
        expect(function () {
            dsl_v1.toDereferenciable(workSpacePath, "/example/does_not_exist")
        }).to.throw("404 [/example/does_not_exist]");
    });

    it("A meta operation (relative) expands to an url.", function () {
        let result = dsl_v1.toDereferenciable(workSpacePath, "./example/exec");
        expect(result).to.equal('http://example.org/dataspaces/example/exec');
    });

    it("A meta operation (absolute) expands to an url.", function () {
        let result = dsl_v1.toDereferenciable(workSpacePath, "/example/exec");
        expect(result).to.equal('http://example.org/dataspaces/example/exec');
    });

});

describe("toDereferenciables", function () {
    let workSpacePath = path.join(__dirname, 'workspace_01');
    let dsl_v1 = getDslWithContext(workSpacePath);
    dsl_v1.buildLocalDependencyGraph(workSpacePath);
    let serverOptions = getServerOptions(workSpacePath);

    it("Does leave an http url as the same", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "http://www.example.org");
        expect(result).to.deep.equal(["http://www.example.org"]);
    });

    it("Does leave an https url as the same", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "https://www.example.org");
        expect(result).to.deep.equal(["https://www.example.org"]);
    });

    it("A file (relative) expands to a file.", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "./example/files/file_1.ttl");
        expect(result).to.deep.equal([workSpacePath + "/example/files/file_1.ttl"]);
    });

    it("A file (absolute) expands to a file.", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "example/files/file_1.ttl");
        expect(result).to.deep.equal([workSpacePath + "/example/files/file_1.ttl"]);
    });

    it("Fails with an invalid pointer", function () {
        expect(function () {
            dsl_v1.toDereferenciables(workSpacePath, "exotic test")
        }).to.throw(Error);
    });

    it("Fails with a file or directory that does not exist", function () {
        expect(function () {
            dsl_v1.toDereferenciables(workSpacePath, "/example/does_not_exist")
        }).to.throw("404 [" + workSpacePath + "/example/does_not_exist]");
    });

    it("A directory (absolute) expands to files.", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "/example/files/*");
        expect(result.sort()).to.deep.equal([
            workSpacePath + "/example/files/file_1.ttl",
            workSpacePath + "/example/files/file_2.ttl"
        ].sort());
    });

    it("A directory (relative) expands to files.", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "./example/files/*");
        expect(result.sort()).to.deep.equal([
            workSpacePath + "/example/files/file_1.ttl",
            workSpacePath + "/example/files/file_2.ttl"
        ].sort());
    });

    it("A meta operation (relative) expands to an url.", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "./example/exec");
        expect(result).to.deep.equal(['http://example.org/' + serverOptions.appEntrypoint + '/example/exec']);
    });

    it("A meta operation (absolute) expands to an url.", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "/example/exec");
        expect(result).to.deep.equal(['http://example.org/' + serverOptions.appEntrypoint + '/example/exec']);
    });

    it("A pattern is expanded according to a glob.", function () {
        let result = dsl_v1.toDereferenciables(workSpacePath, "./example/*/people");
        expect(result.sort()).to.deep.equal([
            'http://example.org/' + serverOptions.appEntrypoint + '/example/pattern_1/people',
            'http://example.org/' + serverOptions.appEntrypoint + '/example/pattern_2/people',
            workSpacePath + "/example/pattern_3/people",
        ].sort());
    });

});

describe("dsl-interpreter", function () {
    let workSpacePath = path.join(__dirname, '/../workspace');
    let dsl_v1 = getDslWithContext(workSpacePath);
    dsl_v1.buildLocalDependencyGraph(workSpacePath);

    function getFeature(exampleName, featureName) {
        let indexFile = path.join(workSpacePath, exampleName, defaultServerOptions.indexFile);
        let contents = fs.readFileSync(indexFile);
        return JSON.parse(contents).features[featureName];
    }

    it("example_01_next", function () {
        let input = getFeature('example_01', 'next');
        let expanded = baseUrl + "/example_02";
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_01'), input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_01_socrates", function () {
        let input = getFeature('example_01', 'socrates');
        let expanded = {
            "description": "Exposes some turtle as Json-ld (default)",
            "raw": "@prefix : <http://www.agfa.com/w3c/euler/socrates#> . :Socrates a :Man ."
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_01'), input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_02", function () {
        let input = getFeature('example_02', 'dbpedia');
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_02'), input);
        expect(result).to.deep.equal(input);
    });

    it("example_03_cindy", function () {
        let input = getFeature('example_03', 'cindy');
        let expanded = {
            "description": "Inference example about dating",
            "inference": {
                "data": [
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/cindy_personal_space/cindy.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/reflexives.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/symmetric.n3"
                ],
                "query": "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/query_all.n3"
            }
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_03'), input);
        expect(result).to.deep.equal(expanded);
    });
    it("example_03_proof", function () {
        let input = getFeature('example_03', 'cindy');
        let expanded = {
            "description": "Inference example about dating",
            "inference": {
                "data": [
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/cindy_personal_space/cindy.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/reflexives.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/symmetric.n3",
                ],
                "query": "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_03/query_all.n3"
            }
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_03'), input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_04_alice", function () {
        let input = getFeature('example_04', 'alice');
        let expanded = {
            "description": "Imports /lib/socrates, but uses ./personal/* as data. ",
            "inference": {
                "data": [
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_04/personal/Alice.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_04/personal/knowledge.n3",
                ],
                "query": "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/query/whoIsWhat.n3",
            }
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_04'), input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_04_alice_and_socrates", function () {
        let input = getFeature('example_04', 'alice_and_socrates');
        let expanded = {
            "description": "Imports /lib/socrates, and adds ./personal/* to the data",
            "inference": {
                "data": [
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/data/knowledge.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/data/socrates.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_04/personal/Alice.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_04/personal/knowledge.n3",
                ],
                "query": "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/query/whoIsWhat.n3",
            }
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_04'), input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_04_when_outside_directory", function () {
        let input = {
            "name": "alice",
            "description": "Alice's space",
            "imports": "/lib/socrates",
            "add": {
                "inference.data": "../../test/example"
            }
        };

        expect(function () {
            dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_04'), input);
        }).to.throw("403 [" + path.join(workSpacePath, "../test/example") + "]");
    });

    it("example_04_alice_without_socrates", function () {
        let input = getFeature('example_04', 'alice_without_socrates');
        let expanded = {
            "description": "Imports /lib/socrates, adds ./personal/* and removes /lib/data/socrates.n3",
            "inference": {
                "data": [
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/data/knowledge.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_04/personal/Alice.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/example_04/personal/knowledge.n3",
                ],
                "query": "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/query/whoIsWhat.n3",
            }
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_04'), input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_05_first_operation", function () {
        let input = getFeature('example_05', 'first_operation');
        let expanded = {
            "description": "Some raw data",
            "raw": "@prefix : <http://www.agfa.com/w3c/euler/socrates#> . :Socrates a :Man ."
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_05'), input);
        expect(result).to.deep.equal(expanded);
    });

    it("example_05_second_operation", function () {
        let input = getFeature('example_05', 'second_operation');
        let expanded = {
            "description": "Uses other operations as resources. ",
            "inference": {
                "data": [
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/data/knowledge.n3",
                    "http://example.org/dataspaces/example_05/first_operation",
                ],
                "query": "http://example.org/dataspaces/example_05/query",
            }
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_05'), input);
        expect(result).to.deep.equal(expanded);
    });


    it("example_05_maintains_content_type", function () {
        let input = {
            "name": "extend",
            "Content-Type": "text/turtle",
            "description": "extend /lib",
            "imports": "/lib/socrates"
        };

        let expanded = {
            "Content-Type": "text/turtle",
            "description": "extend /lib",
            "inference": {
                "data": [
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/data/knowledge.n3",
                    "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/data/socrates.n3",
                ],
                "query": "/home/cvasquez/github.com/cristianvasquez/H-Eye/workspace/lib/query/whoIsWhat.n3",
            }
        };
        let result = dsl_v1.expandMeta(path.join(__dirname + '/../workspace/example_05'), input);
        expect(result).to.deep.equal(expanded);
    });


});

/**
 * Should change to simply check against json schema when dsl is stable.
 */
describe("validator", function () {
    let workSpacePath = path.join(__dirname, '/../workspace');
    let dsl_v1 = getDslWithContext(workSpacePath);
    dsl_v1.buildLocalDependencyGraph(workSpacePath);
    let serverOptions = getServerOptions(workSpacePath);

    it("all_examples", function () {
        const Glob = require("glob").Glob;

        let pattern = "**/" + serverOptions.indexFile;
        let indexes = new Glob(pattern, {
            mark: true,
            sync: true,
            absolute: true,
            nodir: true,
            cwd: workSpacePath
        }).found;

        for (let current of indexes) {
            let contents = fs.readFileSync(current);
            let index = JSON.parse(contents);
            if (index['meta']) {
                for (let operation of index['meta']) {
                    expect(DSL_V1.validateOperation(operation), 'Failed: ' + JSON.stringify(operation, null, 2)).to.equal(true);
                }
            }
        }

    });

});

describe("dependency graphs", function () {

    it("detects all operations from examples", function () {
        let expectedKnownOperations = [
            "/example_01/next",
            "/example_01/socrates",
            "/example_02/dbpedia",
            "/example_02/next",
            "/example_03/cindy",
            "/example_03/next",
            "/example_03/proof",
            "/example_04/alice",
            "/example_04/alice_and_socrates",
            "/example_04/alice_without_socrates",
            "/example_05/first_operation",
            "/example_05/query",
            "/example_05/second_operation",
            "/lib/socrates"].sort();
        let workSpacePath = path.join(__dirname, '/../workspace');
        let dsl = getDslWithContext(workSpacePath);
        let knownOperations = dsl.getAllKnownOperations(workSpacePath).sort();
        expect(knownOperations).to.deep.equal(expectedKnownOperations);
    });

    it("all examples", function () {
        let workSpacePath = path.join(__dirname, '/../workspace');
        let dsl = getDslWithContext(workSpacePath);
        let dependencyGraph = dsl.buildLocalDependencyGraph(workSpacePath);
        expect(dependencyGraph.dependenciesOf('/example_05/second_operation')).to.deep.equal([  "/example_05/query",
            "/example_05/first_operation"]);
    });

    it("detects circular dependencies", function () {
        let workSpacePath = path.join(__dirname, '/workspace_02');
        let dsl = getDslWithContext(workSpacePath);
        expect(function () {
            dsl.buildLocalDependencyGraph(workSpacePath);
        }).to.throw("Maximum call stack size exceeded");

    });

});

// describe("validatorCrud", function () {
//     it("create import", function () {
//         let input = {
//             "imports": {
//                 "@id":"http://localhost:3000/some_path/agent/operation_name",
//                 "Content-Type":"application/x-json+ld",
//                 "addData": {
//                     "href": ["../user_profile","../environment","../other_rule"]
//                 }
//             }
//         };
//         let result = DSL_V1.validateCrudOperation(input);
//         expect(result).to.equal(true);
//     });
// });

describe("toAbsolutePath", function () {

    let workSpacePath = __dirname;
    let dsl_v1 = getDslWithContext(workSpacePath);
    dsl_v1.buildLocalDependencyGraph(workSpacePath);

    describe("toAbsolutePath, basic functionality", function () {

        it("Respects absolute path inside the workspace", function () {
            let result = dsl_v1.toAbsolutePath(workSpacePath + "/inside_1", "/inside_2");
            expect(result).to.equal(workSpacePath + "/inside_2");
        });

        it("Respects relative path inside the workspace", function () {
            let result = dsl_v1.toAbsolutePath(workSpacePath + "/inside_1", "../inside_2");
            expect(result).to.equal(workSpacePath + "/inside_2");
        });

        it("Don't handle relative outside workspace", function () {
            expect(function () {
                dsl_v1.toAbsolutePath(workSpacePath + "/inside", "../../inside_2")
            }).to.throw("403 [" + path.join(workSpacePath + "/inside", "../../inside_2") + "]");
        });

    });
});
