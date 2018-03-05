/**
 * Does Node provide something to do this easily? This is painful!
 */

// Globals
String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.split(search).join(replacement);
};

class _Context {

    constructor(host,originalUrl,serverOptions) {
        if (!serverOptions) {
            throw new Error('Need serverOptions');
        }
        this.serverOptions = serverOptions;
        this.host = host;
        this.originalUrl = originalUrl.replace(/\/$/, "");
    }

    getApiRoot(){
        return "http://" +this.host + "/" + this.serverOptions.appEntrypoint;
    }

    getResourcesRoot(){
        return "http://" +this.host + "/" + this.serverOptions.resourcesEntryPoint;
    }

    // @TODO test
    //   var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    getCurrentPath(){
        return "http://" +this.host + this.originalUrl.replace(/\/$/, "");
    }

    getLocalHref(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), '');
    }

    getLocalDir(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), this.serverOptions.workSpacePath);
    }

    getCurrentResource(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), this.getResourcesRoot())
    }

    getHead(){
        return this.originalUrl.substr(this.originalUrl.lastIndexOf('/') + 1)
    }

    getTail(){
        return new _Context(this.host,this.originalUrl.substr(0, this.originalUrl.lastIndexOf('/')),this.serverOptions);
    }

    toResourcePath(someLocalDir){
        return someLocalDir.replaceAll(this.serverOptions.workSpacePath, "http://" +this.host +'/'+ this.serverOptions.resourcesEntryPoint);
    }

    toApiPath(someLocalDir){
        return someLocalDir.replaceAll(this.serverOptions.workSpacePath, "http://" +this.host +'/'+ this.serverOptions.appEntrypoint);
    }

    getContextForURL(someURI){
        return new _Context(this.host, '/' +this.serverOptions.appEntrypoint + someURI.replaceAll( this.getApiRoot(),''),this.serverOptions);
    }

    isLocalApiPath(someURL){
        return someURL.startsWith(this.getApiRoot());
    }

}

class Context extends _Context{
    constructor(req,serverOptions) {
        super(req.headers.host,req.originalUrl,serverOptions);
    }
}

module.exports = Context;