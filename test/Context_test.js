const expect = require("chai").expect;
const Context = require("../server/Context");

/**
 * Chai: https://devhints.io/chai
 */

// Globals
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

const defaultServerOptions = require("../config").serverOptions;

let serverOptions = JSON.parse(JSON.stringify(defaultServerOptions))
serverOptions.workSpacePath = __dirname;
let request = {
    headers:{
        host:"localhost:3333"
    },
    originalUrl:'/'+serverOptions.appEntrypoint+"/some/url/there"
};

describe("specToPublic: converts an href specific to a set of uris to feed the reasoner", function () {
    let context = new Context(request,serverOptions);

    it("constructor", function () {
        expect(context.host).to.equal('localhost:3333');
        expect(context.originalUrl).to.equal('/dataspaces/some/url/there');
    });

    it("getApiRoot()", function () {
        expect(context.getApiRoot()).to.equal("http://localhost:3333/"+serverOptions.appEntrypoint);
    });

    it("getResourcesRoot()", function () {
        expect(context.getResourcesRoot()).to.equal("http://localhost:3333/"+serverOptions.resourcesEntryPoint);
    });

    it("getCurrentPath()", function () {
        expect(context.getCurrentPath()).to.equal("http://localhost:3333/"+serverOptions.appEntrypoint+"/some/url/there");
    });

    it("getLocalDir()", function () {
        expect(context.getLocalDir()).to.equal(serverOptions.workSpacePath+"/some/url/there");
    });

    it("getCurrentResource()", function () {
        expect(context.getCurrentResource()).to.equal("http://localhost:3333/"+serverOptions.resourcesEntryPoint+"/some/url/there");
    });

    it("getHead()", function () {
        expect(context.getHead()).to.equal("there");
    });

    it("getTail()", function () {
        let context = new Context(request,serverOptions);
        let request_tail = {
            headers:{
                host:"localhost:3333"
            },
            originalUrl:'/'+serverOptions.appEntrypoint+"/some/url"
        };
        expect(context.getTail()).to.deep.equal(new Context(request_tail,serverOptions));
    });

    it("getContextForURL()", function () {
        let context = new Context(request,serverOptions);
        let context2 = context.getContextForURL('http://localhost:3333/dataspaces/serviceDefinitions/T0/step_3');
        expect(context2.getHead()).to.equal('step_3');
        expect(context2.host).to.equal('localhost:3333');
        expect(context2.originalUrl).to.equal('/dataspaces/serviceDefinitions/T0/step_3');

        expect(context2.getLocalHref()).to.equal('/serviceDefinitions/T0/step_3');
        expect(context2.getLocalDir()).to.equal(serverOptions.workSpacePath+'/serviceDefinitions/T0/step_3');
    });

    it("getTail() from root", function () {
        let request_root = {
            headers:{
                host:"localhost:3333"
            },
            originalUrl:'/'+serverOptions.appEntrypoint
        };
        let context = new Context(request_root,serverOptions);
        expect(context.getTail().getCurrentPath()).to.equal("http://localhost:3333");
    });

});
