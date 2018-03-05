const schemas = require("../config").schemas;
const fu = require("./persistence");
const _ = require('lodash');
const validUrl = require('valid-url');
const path = require('path');
const Ajv = require('ajv');
const Glob = require("glob").Glob

// https://github.com/jriecken/dependency-graph
const DepGraph = require('dependency-graph').DepGraph;
const minimatch = require("minimatch");

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
        if (!context) {
            throw new Error('Need context');
        }
        if (!context.serverOptions) {
            throw new Error('Need server options');
        }
        if (!context.serverOptions.workSpacePath) {
            throw new Error('Need workSpacePath');
        }
        this.context = context;
        this.serverOptions = context.serverOptions;
    }

    /**
     * Schema
     */
    static validateOperation(meta) {
        return validateOperation(meta);
    }

    static validateCrudOperation(meta) {
        return validateCrudOperation(meta);
    }

    static validateDeclaration(meta) {
        return validateDeclaration(meta);
    }

    getAllKnownOperations(dirRelativeTo){
        let graph = this.buildLocalDependencyGraph(dirRelativeTo);
        return graph.overallOrder();
    }

    /**
     * Experimental, dependency graph
     */

    toRelativePath(someDirectory){
        return someDirectory.replaceAll(this.serverOptions.workSpacePath,'');
    }

    buildLocalDependencyGraph(dirRelativeTo){
        // Measuring how long it takes
        let start = new Date();


        let graph = new DepGraph();
        // All files
        let pattern = "**/"+this.serverOptions.indexFile;
        let indexes = new Glob(pattern, {mark: true, sync:true, absolute:true, nodir:true, cwd:dirRelativeTo}).found;

        // First run to add all expanded nodes
        for (let currentDir of indexes){
            let index = fu.readJson(currentDir);
            if (index.meta){
                for (let meta of index.meta) {
                    // Take out the index.json part
                    let parent = currentDir.substr(0, currentDir.lastIndexOf('/'));
                    // Make the path relative and add operation name
                    let id = this.toRelativePath(parent) + '/' + meta.name;
                    graph.addNode(id,meta);
                }
            }
        }
        // The graph will be used to expand meta
        this.dependencyGraph = graph;


        //Second run to expand meta and add dependencies
        this.allNodes = this.dependencyGraph.overallOrder();
        for (let id of this.allNodes){
            let meta = graph.getNodeData(id);
            // Take out the operation name
            let parent = id.substr(0, id.lastIndexOf('/'));
            let dirRelativeTo = path.join(this.serverOptions.workSpacePath,parent);
            try {
                let expanded = this.expandMeta(dirRelativeTo, meta);
                graph.setNodeData(id,expanded);
            } catch (e) {
                let error = {
                    message:"ERROR: cannot expand operation",
                    operation:id,
                    meta:meta,
                    source:e.message
                };
                if (e.message==="Maximum call stack size exceeded"){
                    throw e;// Fatal for circular dependencies
                }
                console.error(JSON.stringify(error,null,2));
            }

            this.addDependencies(graph,id,meta)
        }

        var end = new Date() - start;
        console.log('built dependency graph '+end+' ms');

        return graph;
    }

    addDependencies(graph,id,meta){
        if (meta.query || meta['raw']) {
            // No dependencies
        } else if (meta.href) {
            this.addHref(graph,id,meta.href);
        } else if (meta.inference) {
            let inference = meta.inference;

            if (!inference.query){
                throw Error ('No query defined in '+JSON.stringify(meta,null,2));
            }

            // Query dependencies
            if (inference.query.href) {
                this.addHref(graph,id,inference.query.href);
            }
            // Data dependencies
            if (inference.data){
                if (inference.data.href) {
                    let href = inference.data.href;
                    // One value
                    if (typeof href === 'string') {
                        this.addHref(graph,id,href);
                    } else {
                        // Array of values
                        for (let current of href){
                            this.addHref(graph,id,current);
                        }
                    }
                }
            }
        }
    }

    addHref(graph,from,to){
        // A web resource
        if (validUrl.is_web_uri(to)){
            // Which is currently being exposed
            if (this.context.isLocalApiPath(to)){
                // And and a defined operation
                let targetContext = this.context.getContextForURL(to);
                let targetOperation = targetContext.getLocalHref();
                if (graph.hasNode(targetOperation)) { // which could be a defined operation
                    graph.addDependency(from, targetOperation);
                }
            }


        } else { // A local resource
            let targetOperation = this.toRelativePath(to);
            if (graph.hasNode(targetOperation)){ // which could be a defined operation
                graph.addDependency(from, targetOperation);
            }
        }
    }

    /**
     * First layer
     *
     * Expand relative files
     * Expand directories
     * Expand operations
     */

    expandMeta(dirRelativeTo, meta) {
        if (!this.dependencyGraph) {
            throw new Error('Need to build dependencies');
        }

        let valid = validateDeclaration(meta);
        if (!valid) {
            throw Error(JSON.stringify(validateDeclaration.errors,null,2));
        }
        if (meta.query || meta['raw']) {
            return meta;
        } else if (meta.href) {
            return this.expandHref(dirRelativeTo, meta);
        } else if (meta.inference) {
            return this.expandInference(dirRelativeTo, meta);
        } else if (meta.imports) {
            return this.expandImports(dirRelativeTo, meta);
        }
        throw Error("I don't know how to interpret:" + toJson(meta));
    }

    expandHref(dirRelativeTo, meta) {
        meta.href = this.toDereferenciable(dirRelativeTo, meta.href);
        return meta;
    }

    expandInference(dirRelativeTo, meta) {
        let inference = meta.inference;

        // console.log('expand inference',dirRelativeTo);
        // Expand query
        if (inference.query.href) {
            inference.query.href = this.toDereferenciable(dirRelativeTo, inference.query.href);
        }

        if (inference.data.href) {
            let href = inference.data.href;
            // One value
            if (typeof href === 'string') {
                inference.data.href = this.toDereferenciables(dirRelativeTo, href);
            } else {
                // Array of values
                inference.data.href = _.flatMap(href, href => {
                    return this.toDereferenciables(dirRelativeTo, href);
                });
            }

        }
        meta.inference = inference;
        return meta;
    }

    expandImports(dirRelativeTo, meta) {

        let targetPath = this.toAbsolutePath(dirRelativeTo, meta.imports.href);
        let targetOperation = this.toRelativePath(targetPath);

        // Check if this is an operation
        if (this.dependencyGraph.hasNode(targetOperation)) {

            // The operation to be imported
            let _operation = this.dependencyGraph.getNodeData(targetOperation);

            if (_operation.inference) {

                // Build a clone
                // Take out the operation name
                let parent = targetPath.substr(0, targetPath.lastIndexOf('/'));
                let result = JSON.parse(JSON.stringify(this.expandInference(parent,_operation)));

                // Override name if present
                if (meta.name) {
                    result.name = meta.name;
                }
                // Override description if present
                if (meta.description) {
                    result.description = meta.description;
                }
                // Override meta if present
                if (meta['Content-Type']){
                    result['Content-Type'] = meta['Content-Type'];
                }
                /**
                 * It's not clear yet how I will represent Set, Union, Intersection etc.
                 */

                if (meta.imports.query) {
                    result.inference.query = this.toAbsolutePath(dirRelativeTo,context.toResourcePath());
                }

                if (meta.imports.options) {
                    result.inference.options = meta.imports.options;
                }
                if (meta.imports.flags) {
                    result.inference.flags = meta.imports.flags;
                }

                // Special case, addData (adds data to the current extended)
                if (meta.imports.addData) {

                    if (meta.imports.addData.href){

                        let data;
                        if (result.inference.data) {
                            data = result.inference.data.href;
                            // make sure is an array
                            if (typeof data === 'string') {
                                data = [data]
                            }
                        } else {
                            data = [];
                        }

                        let href = meta.imports.addData.href;
                        // make sure is an array
                        if (typeof href === 'string') {
                            href = [href]
                        }
                        // Add them if they are not there
                        for (let current of href) {
                            for (let derref of this.toDereferenciables(dirRelativeTo, current)){
                                if (data.indexOf(derref) < 0) {
                                    data.push(derref);
                                }
                            }
                        }

                        result.inference.data = {
                            'href': data
                        };
                    }
                } else {
                    if (meta.imports.data) {
                        if (meta.imports.data.href) {
                            let href = meta.imports.data.href;
                            // make sure is an array
                            if (typeof href === 'string') {
                                href = [href]
                            }
                            let data = [];
                            for (let current of href) {
                                for (let derref of this.toDereferenciables(dirRelativeTo, current)){
                                    if (data.indexOf(derref) < 0) {
                                        data.push(derref);
                                    }
                                }
                            }
                            result.inference.data =  {
                                'href': data
                            };
                        }
                    }
                }

                return result;
            }

            // Override meta if present
            if (meta['Content-Type']){
                _operation['Content-Type'] = meta['Content-Type'];
            }
            // It was other kind of operation
            console.log('Importing '+JSON.stringify(_operation,null,2));
            return this.expandMeta(targetPath, _operation);
        } else {
            throw new Error('Could not find operation  ' + meta.imports.href + ' in ' + targetPath);
        }
    }


    /**
     * Goes from relative path to absolute path
     * Fails if not in the current workspace
     */
    toAbsolutePath(dirRelativeTo, value) {

        if (typeof value !== 'string') {
            throw Error("I don't know how to handle " + toJson(value));
        }

        // Already expanded
        if (value.startsWith(this.serverOptions.workSpacePath)) {
            return value;
        }

        let result;
        if (path.isAbsolute(value)) {
            result = path.join(this.serverOptions.workSpacePath, value);
        } else {
            result = path.join(dirRelativeTo, value);
        }

        if (!result.startsWith(this.serverOptions.workSpacePath)) {
            throw Error('403 [' + result + ']');
        }

        return result;

    }


    /**
     * Expands an href into a de-referenciable resource (by the reasoner)
     *
     * Valid href values are:
     *
     *  - An external URL, which expands to URL.
     *  - A file (relative), which expands to a absolute file.
     *  - A file (absolute), which expands to a absolute file.
     *  - A call to a meta-operation, which expands to URL.
     */
    toDereferenciable(dirRelativeTo, value) {

        // External URL
        if (validUrl.is_web_uri(value)) { // other uri resources
            return value;
        }

        let targetPath = this.toAbsolutePath(dirRelativeTo, value);
        let targetOperation = this.toRelativePath(targetPath);

        if (this.dependencyGraph.hasNode(targetOperation)){
            return this.context.toApiPath(targetPath);
        }

        if (fu.exists(targetPath)){
            if (fu.isDirectory(targetPath)) {
                return this.context.toApiPath(targetPath);
                // throw Error('400 [' + value + '] is directory');
            }
            return targetPath;
        }

        throw Error('404 [' + value + ']');

    }

    /**
     * Expands an href into a list of de-referenciable resources (by the reasoner)
     *
     * Valid href values are:
     *
     *  - An external URL, which expands to [URL].
     *  - A directory (relative), fails
     *  - A directory (absolute), fails
     *  - A glob file pattern (relative), which expands to a [file].
     *  - A glob file pattern (absolute), which expands to a [file].
     *  - A call to a meta-operation, which expands to [URL].
     */

    // Found the glorious node-glob implementation.

    toDereferenciables(dirRelativeTo, value) {
        // External URL
        if (validUrl.is_web_uri(value)) { // other uri resources
            return [value]
        }

        let results = [];

        // Search for files.
        let glob;
        if (path.isAbsolute(value)) {
            // options for absolute
            // console.log('absolute',value);
            let options = {mark: true, sync:true, root:this.serverOptions.workSpacePath, ignore:'**/'+this.serverOptions.indexFile, absolute:false, nodir:true};
            glob = new Glob(this.toRelativePath(value), options);
        } else {
            // options for relative
            // console.log('relative',dirRelativeTo,value);
            let options = {mark: true, sync:true, cwd:dirRelativeTo, ignore:'**/'+this.serverOptions.indexFile, absolute:true, nodir:true};
            glob = new Glob(value, options);
        }

        if (glob.found && glob.found.length > 0){
            // console.log('found',glob.found);
            results = glob.found;
        }

        // Search for operations
        let targetPath = this.toAbsolutePath(dirRelativeTo, value);
        let targetOperation = this.toRelativePath(targetPath);
        let matches = minimatch.match(this.allNodes, targetOperation);

        for (let current of matches){
            let operationLocalPath = path.join(this.context.serverOptions.workSpacePath,current);
            results.push(this.context.toApiPath( operationLocalPath ))
        }

        if (results.length > 0) {
            return results;
        }

        if (!fu.exists(targetPath)){
            throw Error('404 [' + targetPath + ']');
        }

        if (fu.isDirectory(targetPath)){
            throw Error('400 [' + targetPath + '] is directory');
        }

        throw Error('500 [' + targetPath + ' unhandled error ]');
    }

}

module.exports = DSL_V1;