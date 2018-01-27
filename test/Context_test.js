var expect = require("chai").expect;
var Context = require("../server/Context");
var serverOptions = require("../config").serverOptions;

/**
 * Chai: https://devhints.io/chai
 */

// Globals
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

serverOptions.workSpacePath = __dirname;
let request = {
    headers:{
        host:"localhost:3333"
    },
    originalUrl:'/'+serverOptions.appEntrypoint+"/some/url/there"
};

describe("Basic functions", function () {

    describe("specToPublic: converts an href specific to a set of uris to feed the reasoner", function () {

        it("getApiRoot()", function () {
            let context = new Context(request);
            expect(context.getApiRoot()).to.equal("http://localhost:3333/"+serverOptions.appEntrypoint);
        });

        it("getResourcesRoot()", function () {
            let context = new Context(request);
            expect(context.getResourcesRoot()).to.equal("http://localhost:3333/"+serverOptions.resourcesEntryPoint);
        });

        it("getCurrentPath()", function () {
            let context = new Context(request);
            expect(context.getCurrentPath()).to.equal("http://localhost:3333/"+serverOptions.appEntrypoint+"/some/url/there");
        });

        it("getLocalDir()", function () {
            let context = new Context(request);
            expect(context.getLocalDir()).to.equal(serverOptions.workSpacePath+"/some/url/there");
        });

        it("getCurrentResource()", function () {
            let context = new Context(request);
            expect(context.getCurrentResource()).to.equal("http://localhost:3333/"+serverOptions.resourcesEntryPoint+"/some/url/there");
        });

        it("getHead()", function () {
            let context = new Context(request);
            expect(context.getHead()).to.equal("there");
        });

        it("getTail()", function () {
            let context = new Context(request);
            let request_tail = {
                headers:{
                    host:"localhost:3333"
                },
                originalUrl:'/'+serverOptions.appEntrypoint+"/some/url"
            };
            expect(context.getTail()).to.deep.equal(new Context(request_tail));
        });

        it("getTail() from root", function () {
            let request_root = {
                headers:{
                    host:"localhost:3333"
                },
                originalUrl:'/'+serverOptions.appEntrypoint
            };
            let context = new Context(request_root);
            expect(context.getTail().getCurrentPath()).to.equal("http://localhost:3333");
        });

    });
});