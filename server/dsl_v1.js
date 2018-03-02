const serverOptions = require("../config").serverOptions;
const schemas = require("../config").schemas;
const fu = require("./persistence");
const _ = require('lodash');
const validUrl = require('valid-url');
const path = require('path');
const Ajv = require('ajv');
const fs = require('fs-extra');
var Glob = require("glob").Glob

// https://github.com/jriecken/dependency-graph
const DepGraph = require('dependency-graph').DepGraph;

function toJson(x) {
    return JSON.stringify(x, null, 2);
}

let ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}
let metaOperationSchema = fu.readJson(schemas.metaOperationSchema);
let crudOperationsSchema = fu.readJson(schemas.crudOperationsSchema);
let hEyeSchema = fu.readJson(schemas.hEyeSchema);

let validateOperation = ajv.compile(metaOperationSchema);
let validateCrudOperation = ajv.compile(crudOperationsSchema);
let validateDeclaration = ajv.compile(hEyeSchema);


class DSL_V1 {

    constructor(context) {
        this.context = context;
    }

    static validateOperation(meta) {
        let valid = validateOperation(meta);
        if (!valid) console.error(validateOperation.errors);
        return valid;
    }

    static validateCrudOperation(meta) {
        let valid = validateCrudOperation(meta);
        if (!valid) console.error(validateCrudOperation.errors);
        return valid;
    }

    static validateDeclaration(meta) {
        let valid = validateDeclaration(meta);
        if (!valid) console.error(validateDeclaration.errors);
        return valid;
    }

    /**
     * Experimental, dependency graph
     */
    buildLocalDependencyGraph(dirRelativeTo){

        let graph = new DepGraph({ circular: false });

        // All files
        let pattern = "**/index.json";
        let indexes = new Glob(pattern, {mark: true, sync:true, absolute:true, nodir:true, cwd:serverOptions.workSpacePath}).found;
        for (let currentDir of indexes){
            let index = fu.readJson(currentDir);
            if (index['hes:meta']){
                for (let meta of index['hes:meta']) {
                    let parent = currentDir.substr(0, currentDir.lastIndexOf('/'));
                    let id = (parent.replaceAll(serverOptions.workSpacePath, '') + '/' + meta['hes:name']);
                    graph.addNode(id, meta );
                }
            }
        }

        for (let currentDir of indexes){
            let index = fu.readJson(currentDir);
            if (index['hes:meta']){
                for (let meta of index['hes:meta']) {
                    addDependencies(currentDir,meta);
                }
            }
        }


        function addHref(dirRelativeTo,from,to){
            if (!validUrl.is_web_uri(to)) {
                let dependency = DSL_V1.toAbsolutePath(dirRelativeTo,to);
                let operation = DSL_V1.findOperation(dependency);
                if (operation.exists) {
                    graph.addDependency(from, dependency.replaceAll(serverOptions.workSpacePath,''));
                }
            }
        }

        function addInferenceDependencies(dirRelativeTo,from,inference,field){
            if (inference[field]){
                if (inference[field]['hes:href']) {
                    let href = inference[field]['hes:href'];
                    // One value
                    if (typeof href === 'string') {
                        addHref(dirRelativeTo,from,href);
                    } else {
                        // Array of values
                        inference[field]['hes:href'] = _.flatMap(href, href => {
                            addHref(dirRelativeTo,from,href);
                        });
                    }
                }
            }
        }

        function addDependencies(dirRelativeTo,meta){
            let parent = dirRelativeTo.substr(0, dirRelativeTo.lastIndexOf('/'));
            let from = (parent.replaceAll(serverOptions.workSpacePath,'')+'/'+meta['hes:name']);

            if (meta['hes:query'] || meta['hes:raw']) {
                // No dependencies
            } else if (meta["hes:href"]) {
                addHref(dirRelativeTo,from,meta["hes:href"]);
            } else if (meta["hes:inference"]) {
                let inference = meta["hes:inference"];

                // Query dependencies
                if (inference['hes:query']['hes:href']) {
                    addHref(dirRelativeTo,from,inference['hes:query']['hes:href']);
                }
                // Data dependencies
                addInferenceDependencies(dirRelativeTo,from,inference,'hes:data')
            } else if (meta["hes:imports"]) {
                let imports = meta["hes:imports"];

                addHref(dirRelativeTo,from,imports['hes:href']);

                // Query dependencies
                if (imports['hes:query']){
                    if (imports['hes:query']['hes:href']) {
                        addHref(dirRelativeTo,from,imports['hes:query']['hes:href']);
                    }
                }
                addInferenceDependencies(dirRelativeTo,from,imports,'hes:data');
                addInferenceDependencies(dirRelativeTo,from,imports,'hes:addData');
            }
        }

        for (let operation of graph.overallOrder()){
            let nodeData = graph.getNodeData(operation);
            let operationDir = DSL_V1.toAbsolutePath(serverOptions.workSpacePath,operation);
            operationDir = operationDir.substr(0, operationDir.lastIndexOf('/'));
            graph.setNodeData(operation, this.expandMeta(operationDir,   nodeData));
        }

        return graph;
    }

    /**
     * First layer
     *
     * Expand relative files
     * Expand directories
     */

    expandMeta(dirRelativeTo, meta) {
        let valid = validateDeclaration(meta);
        if (!valid) {
            throw Error(JSON.stringify(validateDeclaration.errors,null,2));
        }

        if (meta['hes:query'] || meta['hes:raw']) {
            return meta;
        } else if (meta["hes:href"]) {
            return this.expandHref(dirRelativeTo, meta);
        } else if (meta["hes:inference"]) {
            return this.expandInference(dirRelativeTo, meta);
        } else if (meta["hes:imports"]) {
            return this.expandImports(dirRelativeTo, meta);
        }
        throw Error("I don't know how to interpret:" + toJson(meta));
    }

    expandHref(dirRelativeTo, meta) {
        meta["hes:href"] = this.toDereferenciable(dirRelativeTo, meta["hes:href"]);
        return meta;
    }

    expandInference(dirRelativeTo, meta) {
        let inference = meta["hes:inference"];

        // Expand query
        if (inference['hes:query']['hes:href']) {
            inference['hes:query']['hes:href'] = this.toDereferenciable(dirRelativeTo, inference['hes:query']['hes:href']);
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

    expandImports(dirRelativeTo, meta) {

        let targetDir = DSL_V1.toAbsolutePath(dirRelativeTo, meta["hes:imports"]['hes:href']);
        let _operation = DSL_V1.findOperation(targetDir);

        if (_operation.exists) {
            targetDir = targetDir.substr(0, targetDir.lastIndexOf('/'));

            // Override meta if present
            if (meta['hes:Content-Type']){
                _operation.operation['hes:Content-Type'] = meta['hes:Content-Type'];
            }

            if (_operation.operation['hes:inference']) {

                // This expansion is to keep the absolute paths of the extended.
                let operation = this.expandInference(targetDir, _operation.operation);

                /**
                 * It's not clear yet how I will represent Set, Union, Intersection etc.
                 */
                meta['hes:inference'] = {};

                function overrideIfExisting(current) {
                    // If parameter is defined in the extends clause, it overrides the one of the extended one.
                    if (meta['hes:imports'][current]) {
                        meta['hes:inference'][current] = meta['hes:imports'][current];
                    } else {
                        if (operation['hes:inference'][current]) {
                            meta['hes:inference'][current] = operation['hes:inference'][current];
                        }
                    }
                }

                overrideIfExisting('hes:query');
                overrideIfExisting('hes:options');
                overrideIfExisting('hes:flags');

                // Special case, hes:addData (adds data to the current extended)
                if (meta['hes:imports']['hes:addData']) {
                    let data = [];
                    if (operation['hes:inference']['hes:data']) {
                        data = operation['hes:inference']['hes:data']['hes:href'];
                    }
                    let href = meta['hes:imports']['hes:addData']['hes:href'];
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

                delete meta['hes:imports'];
                return this.expandInference(dirRelativeTo, meta);
            }

            // It was other kind of operation
            return this.expandMeta(targetDir, _operation.operation);
        } else {
            throw new Error("Could not find operation  '" + meta["hes:imports"]['hes:href'] + "' in " + targetDir);
        }
    }

    static findOperation(target) {
        let targetDir = target.substr(0, target.lastIndexOf('/'));
        let name = target.substr(target.lastIndexOf('/') + 1);

        // Gets the template
        if (fu.exists(targetDir + '/' + serverOptions.indexFile)) {
            let index = fu.readJson(targetDir + '/' + serverOptions.indexFile);
            if (index['hes:meta']) {
                for (let operation of index['hes:meta']) {
                    if (operation['hes:name'] === name) {
                        return {
                            exists: true,
                            operation: operation
                        }
                    }
                }
            }
        }
        return {
            exists: false
        }
    }

    /**
     * Goes from relative path to absolute path
     * Fails if not in the current workspace
     */
    static toAbsolutePath(dirRelativeTo, value) {

        if (typeof value !== 'string') {
            throw Error("I don't know how to handle " + toJson(value));
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

        // If its already expanded
        let targetPath = DSL_V1.toAbsolutePath(dirRelativeTo, value);

        if (!fu.exists(targetPath)){
            let operation = DSL_V1.findOperation(targetPath);
            if (operation.exists) {
                if (this.context){
                    return this.context.toApiPath(targetPath);
                } else {
                    return targetPath.replaceAll(serverOptions.workSpacePath,'');
                }
            }
            throw Error("404 [" + value + "]");
        } else {
            return targetPath;
        }
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

    // Found the glorious node-glob implementation.

    toDereferenciables(dirRelativeTo, value) {
        // External URL
        if (validUrl.is_web_uri(value)) { // other uri resources
            return [value]
        }

        let glob;
        if (path.isAbsolute(value)) {
            // options for absolute
            let options = {mark: true, sync:true, root:serverOptions.workSpacePath, ignore:'**/index.json', absolute:false, nodir:true};
            glob = new Glob(value.replaceAll(serverOptions.workSpacePath,''), options);
        } else {
            // options for relative
            let options = {mark: true, sync:true, cwd:dirRelativeTo, ignore:'**/index.json', absolute:true, nodir:true};
            glob = new Glob(value, options);
        }


        if (glob.found && glob.found.length > 0){
            return glob.found;
        }

        let targetPath = DSL_V1.toAbsolutePath(dirRelativeTo, value);
        let operation = DSL_V1.findOperation(targetPath);
        if (operation.exists) {
            if (this.context){
                return [this.context.toApiPath(targetPath)];
            } else {
                return [targetPath.replaceAll(serverOptions.workSpacePath,'')];
            }
        }

        if (!fu.exists(targetPath)){
            throw Error("404 [" + targetPath + "]");
        }

        if (fu.isDirectory(targetPath)){
            throw Error("400 [" + targetPath + "] is directory");
        }

        throw Error("500 [" + targetPath + " unhandled error ]");
    }

}

module.exports = DSL_V1;