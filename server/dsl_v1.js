const serverOptions = require("../config").serverOptions;
const fu = require("./persistence");
const _ = require('lodash');
const validUrl = require('valid-url');
const path = require('path');

function toJson(x) {
    return JSON.stringify(x, null, 2);
}

/**
 * Handles a defined href, in case of having a corresponding local path, returns it.
 */

class DSL_V1 {

    constructor(context) {
        this.context = context;
    }

    /**
     * First layer
     *
     * Expand relative files
     * Expand directories
     */

    expandMeta(dirRelativeTo, meta) {
        if (meta['hes:query'] || meta['hes:raw']) {
            return meta;
        } else if (meta["hes:href"]) {
            return this.expandHref(dirRelativeTo, meta);
        } else if (meta["hes:inference"]) {
            return this.expandInference(dirRelativeTo, meta);
        } else if (meta["hes:extends"]) {
            return this.expandExtends(dirRelativeTo, meta);
        }
        throw Error("I don't know how to interpret:" + toJson(meta));
    }

    static validateMeta(meta) {
        if (meta['hes:inference']) {
            if (Array.isArray(meta['hes:inference']['hes:data'])) {
                console.error('array not allowed in ' + toJson(meta));
                return false;
            }
        }
        if (meta['hes:extends']) {
            if (Array.isArray(meta['hes:extends']['hes:data'])) {
                console.error('array not allowed in ' + toJson(meta));
                return false;
            }
        }
        return true;
    }

    expandHref(dirRelativeTo, meta) {
        meta["hes:href"] = this.toDereferenciable(dirRelativeTo, meta["hes:href"]);
        return meta;
    }

    expandInference(dirRelativeTo, meta) {
        let inference = meta["hes:inference"];


        // Expand query

        if (!inference['hes:query']) { // This is getting ugly, this needs to be checked by some schema
            throw Error("Query needs to be defined in " + toJson(inference));
        }

        if (!inference['hes:query']['hes:raw'] && !inference['hes:query']['hes:href']) {
            throw Error("Query needs to be defined in " + toJson(inference));
        }

        if (inference['hes:query']['hes:href']) {
            inference['hes:query']['hes:href'] = this.toDereferenciable(dirRelativeTo, inference['hes:query']['hes:href']);
        }
        // Expand data
        if (!inference['hes:data']['hes:raw'] && !inference['hes:data']['hes:href']) {
            throw Error("Data needs to be defined in " + toJson(inference));
        }
        if (inference['hes:data']['hes:href']) {
            let href = inference['hes:data']['hes:href'];
            // One value
            if (typeof href === 'string') {
                inference['hes:data']['hes:href'] = this.toDereferenciables(dirRelativeTo, href);
            } else {
                // Array of values
                inference['hes:data']['hes:href'] = _.flatMap(href, href => {
                    return this.toDereferenciables(dirRelativeTo, href);
                });
            }

        }
        meta["hes:inference"] = inference;
        return meta;
    }

    expandExtends(dirRelativeTo, meta) {
        if (!meta["hes:extends"]['hes:href']) throw new Error('No href in extends ' + toJson(meta));
        if (!meta["hes:extends"]['hes:name']) throw new Error('No name in extends ' + toJson(meta));

        let targetDir = DSL_V1.toAbsolutePath(dirRelativeTo, meta["hes:extends"]['hes:href']);


        let _operation = DSL_V1.findOperation(targetDir, meta["hes:extends"]['hes:name']);
        if (_operation.exists) {

            if (_operation.operation['hes:inference']) {

                // This expansion is to keep the absolute paths of the extended.
                let operation = this.expandInference(targetDir, _operation.operation);

                /**
                 * It's not clear yet how I will represent Set, Union, Intersection etc.
                 */
                meta['hes:inference'] = {};

                function overrideIfExisting(current) {
                    // If parameter is defined in the extends clause, it overrides the one of the extended one.
                    if (meta['hes:extends'][current]) {
                        meta['hes:inference'][current] = meta['hes:extends'][current];
                    } else {
                        if (operation['hes:inference'][current]) {
                            meta['hes:inference'][current] = operation['hes:inference'][current];
                        }
                    }
                }

                overrideIfExisting('hes:query');
                overrideIfExisting('hes:options');
                overrideIfExisting('hes:flags');
                overrideIfExisting('hes:Accept');

                // Special case, hes:addData (adds data to the current extended)
                if (meta['hes:extends']['hes:addData']) {
                    let data = [];
                    if (operation['hes:inference']['hes:data']) {
                        data = operation['hes:inference']['hes:data']['hes:href'];
                    }
                    let href = meta['hes:extends']['hes:addData']['hes:href'];
                    // make sure is an array
                    if (typeof href === 'string') {
                        href = [href]
                    }
                    // Add them if they are not there
                    for (let current of href) {
                        if (data.indexOf(current) < 0) {
                            data.push(current);
                        }
                    }
                    meta['hes:inference']['hes:data'] = {
                        'hes:href': data
                    };
                } else {
                    overrideIfExisting('hes:data');
                }

                delete meta['hes:extends'];
                return this.expandInference(dirRelativeTo, meta);
            }
            // It was other kind of operation
            return this.expandMeta(targetDir, _operation.operation);
        } else {
            throw new Error("Could not find operation  '" + meta["hes:extends"]['hes:name'] + "' in " + targetDir);
        }
    }

    static findOperation(targetDir, name) {
        // Gets the template
        if (fu.exists(targetDir + '/' + serverOptions.indexFile)) {
            let index = fu.readJson(targetDir + '/' + serverOptions.indexFile);
            if (index['hes:meta']) {
                for (let operation of index['hes:meta']) {
                    if (operation['hes:name'] === name) {
                        return {exists: true, operation};
                    }
                }
            }
        }
        return {exists: false}
    }

    /**
     * Transforms a relative path into an absolute path (for the current workspace)
     */
    static toAbsolutePath(dirRelativeTo, value) {
        if (typeof value !== 'string') {
            throw Error("I don't know how to handle" + value);
        }

        // Already expanded
        if (value.startsWith(serverOptions.workSpacePath)) {
            return value;
        }

        let result;
        if (path.isAbsolute(value)) {
            result = path.join(serverOptions.workSpacePath, value);
        } else {
            result = path.join(dirRelativeTo, value);
        }

        if (!result.startsWith(serverOptions.workSpacePath)) {
            throw Error("403 [" + result + "]");
        }

        return result;

    }

    /**
     * Expands an hes:href into a de-referenciable resource (by the reasoner)
     *
     * Valid hes:href values are:
     *
     *  - An external URL, which expands to URL.
     *  - A file (relative), which expands to a file.
     *  - A file (absolute), which expands to a file.
     *  - A call to a meta-operation, which expands to URL.
     */
    toDereferenciable(dirRelativeTo, value) {

        // External URL
        if (validUrl.is_web_uri(value)) { // other uri resources
            return value;
        }

        let target = DSL_V1.toAbsolutePath(dirRelativeTo, value);

        if (fu.exists(target)) {
            // Absolute and relative files
            return target;
        }

        /**
         * If there is a context defined, then we can search for possible virtual operations,
         * (this is used when chaining operations.)
         */
        if (this.context) {
            let operation = DSL_V1.findOperation(
                target.substr(0, target.lastIndexOf('/')),
                target.substr(target.lastIndexOf('/') + 1)
            );
            if (operation.exists) {
                return this.context.toApiPath(target);
            }
        }

        // Nothing was found
        throw Error("404 [" + value + "]");
    }

    /**
     * Expands an hes:href into a list of de-referenciable resources (by the reasoner)
     *
     * Valid hes:href values are:
     *
     *  - An external URL, which expands to [URL].
     *  - A directory (relative), which expands to an array of files.
     *  - A directory (absolute), which expands to an array of files.
     *  - A file (relative), which expands to a [file].
     *  - A file (absolute), which expands to a [file].
     *  - A call to a meta-operation, which expands to an URL
     */
    toDereferenciables(dirRelativeTo, value) {

        // External URL
        if (validUrl.is_web_uri(value)) { // other uri resources
            return [value]
        }
        let target = DSL_V1.toAbsolutePath(dirRelativeTo, value);

        let files = fu.readDir(target).files;

        if (!files) {
            /**
             * If there is a context defined, then we can search for possible virtual operations,
             * (this is used when chaining operations.)
             */
            if (this.context) {
                let operation = DSL_V1.findOperation(
                    target.substr(0, target.lastIndexOf('/')),
                    target.substr(target.lastIndexOf('/') + 1)
                );
                if (operation.exists) {
                    return [this.context.toApiPath(target)];
                }
            }        // Sometimes already expanded (extends case)

            if (fu.exists(target)) {
                return [target];
            }

            // Nothing was found
            throw Error("404 [" + target + "]");
        }

        return files.filter(x => !x.endsWith(serverOptions.indexFile));
    }

    addOperation(currentMeta, newOperation) {

        // First time a meta is defined
        if (!currentMeta){
            currentMeta = [];
        }

        // Check for name (again, this should use some sort of schema, and not be in the code)
        let newName = newOperation['hes:name'];
        if (!newName){
            throw Error("Need to define name");
        }

        if (!newOperation['hes:extends']) {
            throw Error("Only hes:extends supported at the moment");
        }

        if (!newOperation['hes:extends']['@id']) {
            throw Error("Needs URI of the new operation");
        }

        // Check if this resource already has an operation with this name.
        for (let current of currentMeta) {
            if (current['hes:name']===newName){
                throw Error(newName+" already defined");
            }
        }

        let targetContext = this.context.getContextForURL(newOperation['hes:extends']['@id']);
        let _operation = DSL_V1.findOperation(targetContext.getTail().getLocalDir(), targetContext.getHead());
        if (!_operation.exists){
            throw Error("cannot find operation at: "+ newOperation['hes:extends']['@id']);
        }

        newOperation['hes:extends']['hes:name'] = targetContext.getHead();
        newOperation['hes:extends']['hes:href'] = targetContext.getTail().getLocalHref();
        delete newOperation['@id'];

        currentMeta.push(newOperation);
        return currentMeta;
    }


}


module.exports = DSL_V1;