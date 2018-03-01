const serverOptions = require("../config").serverOptions;
const schemas = require("../config").schemas;
const fu = require("./persistence");
const _ = require('lodash');
const validUrl = require('valid-url');
const path = require('path');
const Ajv = require('ajv');
const fs = require('fs-extra');

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

    buildLocalDependencyGraph(absolutePath){
        let graph = new DepGraph();

        const walkSync = (currentDir, apply) => {
            if (fs.statSync(currentDir).isDirectory()) {
                return fs.readdirSync(currentDir).map(f => walkSync(path.join(currentDir, f),apply))
            } else {
                if (currentDir.endsWith(serverOptions.indexFile)) {
                    let index = fu.readJson(currentDir);
                    if (index['hes:meta']){
                        for (let meta of index['hes:meta']) {
                            apply(currentDir, meta)
                        }
                    }
                }
                return undefined
            }
        };

        function addNodes(dirRelativeTo, meta){
            let parent = dirRelativeTo.substr(0, dirRelativeTo.lastIndexOf('/'));
            let id = (parent.replaceAll(serverOptions.workSpacePath,'')+'/'+meta['hes:name']);
            graph.addNode(id, meta);
        }

        function addHref(dirRelativeTo,from,to){
            if (!validUrl.is_web_uri(to)) {
                let dependency = DSL_V1.toAbsolutePath(dirRelativeTo,to);
                let operation = DSL_V1.findOperationByAbsolutePath(dependency);
                if (operation.exists) {
                    graph.addDependency(from, dependency.replaceAll(serverOptions.workSpacePath,''));
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
                if (inference['hes:data']['hes:href']) {
                    let href = inference['hes:data']['hes:href'];
                    // One value
                    if (typeof href === 'string') {
                        addHref(dirRelativeTo,from,href);
                    } else {
                        // Array of values
                        inference['hes:data']['hes:href'] = _.flatMap(href, href => {
                            addHref(dirRelativeTo,from,href);
                        });
                    }
                }
            } else if (meta["hes:imports"]) {
                //  TODO
            }
        }


        walkSync(absolutePath, addNodes);
        walkSync(absolutePath, addDependencies);

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
        let _operation = DSL_V1.findOperation(targetDir, meta["hes:imports"]['hes:name']);
        if (_operation.exists) {

            // Override meta if present
            if (meta['hes:Content-Type']){
                _operation.operation['hes:Content-Type']=meta['hes:Content-Type'];
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
            throw new Error("Could not find operation  '" + meta["hes:imports"]['hes:name'] + "' in " + targetDir);
        }
    }


    static findOperationByAbsolutePath(target) {
        let targetDir = target.substr(0, target.lastIndexOf('/'))
        let name = target.substr(target.lastIndexOf('/') + 1)
        return DSL_V1.findOperation(targetDir, name)
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
            // Splits the URI to find the current local operation.
            let operation = DSL_V1.findOperationByAbsolutePath(target);
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
                let operation = DSL_V1.findOperationByAbsolutePath(target);
                if (operation.exists) {
                    return [this.context.toApiPath(target)];
                }
            }

            if (fu.exists(target)) {
                return [target];
            }

            // Nothing was found
            throw Error("404 [" + target + "]");
        }

        return files.filter(x => !x.endsWith(serverOptions.indexFile));
    }

}

module.exports = DSL_V1;