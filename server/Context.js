const serverOptions = require("../config").serverOptions;

/**
 * Does Node provide something to do this easily? This is painful!
 */

// Globals
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};


class _Context {

    constructor(host,originalUrl) {
        this.host = host;
        this.originalUrl = originalUrl.replace(/\/$/, "");
    }

    getApiRoot(){
        return "http://" +this.host + "/" + serverOptions.appEntrypoint;
    }

    getResourcesRoot(){
        return "http://" +this.host + "/" + serverOptions.resourcesEntryPoint;
    }

    getCurrentPath(){
        return "http://" +this.host + this.originalUrl.replace(/\/$/, "");
    }

    getLocalDir(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), serverOptions.workSpacePath);
    }

    getCurrentResource(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), this.getResourcesRoot())
    }

    getHead(){
        return this.originalUrl.substr(this.originalUrl.lastIndexOf('/') + 1)
    }

    getTail(){
        return new _Context(this.host,this.originalUrl.substr(0, this.originalUrl.lastIndexOf('/')));
    }

    // getContextForLocalDir(localDir){
    //     return new _Context(this.host,localDir.replaceAll(serverOptions.workSpacePath,"/"+serverOptions.appEntrypoint));
    // }

    isLocalUrl(someURI){
        return someURI.startsWith(this.getApiRoot());
    }

    toLocalDir(someURI){
        return someURI.replaceAll(this.getApiRoot(), serverOptions.workSpacePath);
    }

    toResourcePath(someLocalDir){
        return someLocalDir.replaceAll(serverOptions.workSpacePath, "http://" +this.host +'/'+ serverOptions.resourcesEntryPoint);
    }

    toApiPath(someLocalDir){
        return someLocalDir.replaceAll(serverOptions.workSpacePath, "http://" +this.host +'/'+ serverOptions.appEntrypoint);
    }

}

class Context extends _Context{
    constructor(req) {
        super(req.headers.host,req.originalUrl);
    }
}

module.exports = Context;