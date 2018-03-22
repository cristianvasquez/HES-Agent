/**
 * Does Node provide something to do this easily? This is painful!
 */

// Globals
String.prototype.replaceAll = function (search, replacement) {
    let target = this;
    return target.split(search).join(replacement);
};

class BaseContext {

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

    getCurrentPath(){
        return "http://" +this.host + this.originalUrl.replace(/\/$/, "");
    }

    getLocalHref(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), '');
    }

    getLocalDir(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), this.serverOptions.workSpacePath);
    }

    getLocalDirForResource(someResourceUrl){
        return someResourceUrl.replaceAll(this.getResourcesRoot(), this.serverOptions.workSpacePath);
    }

    getCurrentResource(){
        return this.getCurrentPath().replaceAll(this.getApiRoot(), this.getResourcesRoot())
    }

    getHead(){
        return this.originalUrl.substr(this.originalUrl.lastIndexOf('/') + 1)
    }

    getTail(){
        return new BaseContext(this.host,this.originalUrl.substr(0, this.originalUrl.lastIndexOf('/')),this.serverOptions);
    }

    toResourcePath(someLocalDir){
        return someLocalDir.replaceAll(this.serverOptions.workSpacePath, "http://" +this.host +'/'+ this.serverOptions.resourcesEntryPoint);
    }

    toApiPath(someLocalDir){
        return someLocalDir.replaceAll(this.serverOptions.workSpacePath, "http://" +this.host +'/'+ this.serverOptions.appEntrypoint);
    }

    getContextForURL(someURI){
        return new BaseContext(this.host, '/' +this.serverOptions.appEntrypoint + someURI.replaceAll( this.getApiRoot(),''),this.serverOptions);
    }

    isLocalApiPath(someURL){
        return someURL.startsWith(this.getApiRoot());
    }

}

class Context extends BaseContext{
    constructor(req,serverOptions) {
        super(req.headers.host,req.originalUrl,serverOptions);
    }
}

Context.byHostAndUrl = function (host,originalUrl,serverOptions) {
    return new BaseContext(host,originalUrl,serverOptions)
};

module.exports = Context;