const express = require("express");
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const JSONLDParser = require('../lib/N3Parser/JSONLDParser');
const Context = require("../Context");
const reasoner = require("../reasoning");
const DSL_V1 = require("../dsl_v1");
const rp = require('request-promise');
let hash = require('string-hash');

/**
 * Uses processorOptions as constructor
 *
 * Builds dependency tree the first time is needed.
 * In the meantime this is refreshed through the *\/operations endpoint
 */
class HES extends express.Router {


    constructor(processorOptions,serverOptions) {
        super();

        if (!processorOptions) {
            throw new Error("must define processor options");
        }

        if (!serverOptions) {
            throw new Error("must define server options");
        }

        function getDSL(req){
            let context = new Context(req, serverOptions);
            return new DSL_V1(context);
        }


        let dependencyGraph = undefined;

        function getDependencyGraph(req) {
            if (!dependencyGraph){
                rebuildGraph(req);
            }
            return dependencyGraph;
        }

        function rebuildGraph(req){
            let context = new Context(req, serverOptions);
            let dsl = new DSL_V1(context);
            dependencyGraph = dsl.buildLocalDependencyGraph(serverOptions.workSpacePath);
        }


        /**
         * Exports metadata about the operations on a given URL
         */
        this.get("*/operations", function (req, res, next) {
            rebuildGraph(req);
            let graph = getDependencyGraph(req);

            let context = new Context(req, serverOptions);
            let currentPath = context.getTail().getLocalHref();
            let allNodes = graph.overallOrder();

            for (let id of allNodes){
                // Filter out others
                if (!id.startsWith(currentPath)){
                    graph.removeNode(id);
                }
            }
            res.json(graph);
        });

        /**
         * Some operations (I don't have a clear idea yet of which ones to support)
         */

        if (processorOptions.hydraOperations.indexOf('POST') !== -1) {
            this.post("*/operations", function (req, res, next) {
                if(req.body.clone){
                    clone(req,res,next)
                } else {
                    createOrUpdateMeta(req, res, next);
                }
            });
        }

        if (processorOptions.hydraOperations.indexOf('PUT') !== -1) {
            this.put("*/operations", function (req, res, next) {
                if(req.body.clone){
                    clone(req,res,next)
                } else {
                    createOrUpdateMeta(req, res, next);
                }
            });
        }

        function clone(req, res, next) {
            let context = new Context(req,serverOptions);

            let clone = req.body.clone;
            let id = clone['@id'];
            if (!id){
                res.status(400).json({error: 'Has no source dir defined', operation:req.body});
            }

            if (!context.isLocalApiPath(id)){
                res.status(403).json({error: 'Cannot clone resource', operation:req.body});
            }

            let sourceDir = context.getContextForURL(id).getLocalDir();
            if (!fu.exists(sourceDir)){
                res.status(400).json({error: 'Source dir does not exist', operation:req.body});
            }
            if (!fu.isDirectory(sourceDir)){
                res.status(400).json({error: 'Source dir is not directory', operation:req.body});
            }

            let targetDir = context.getTail().getLocalDir();
            console.log('Cloning '+sourceDir+' into '+targetDir);

            fu.copyDirectory(sourceDir,targetDir,req.body.clone.recursive);
            // Rebuild the dependency graph
            rebuildGraph(req);
            res.json({'@id': context.toApiPath(targetDir)});

        }

        function createOrUpdateMeta(req, res, next) {

            let context = new Context(req,serverOptions);
            let targetDir = context.getTail().getLocalDir();

            // check if there is a descriptor file
            let indexPath = targetDir + '/' + serverOptions.indexFile;
            if (!fu.exists(indexPath)) {
                res.status(400).json({error: context.getCurrentPath() + ' has no descriptor file'});
            }

            // check if payload is valid
            let newOperation = req.body;
            let valid = DSL_V1.validateCrudOperation(newOperation);
            if (!valid) {
                res.status(400).json({error: JSON.stringify(DSL_V1.validateCrudOperation.errors, null, 2)});
            }
            let targetName = newOperation.name;
            if (!targetName) {
                res.status(400).json({error: 'Has no name defined', operation:newOperation});
            }

            // get the meta descriptions
            let index = fu.readJson(indexPath);
            let meta = index.meta;

            // First time a meta is defined
            if (!meta) {
                meta = [];
            }
            // Remove existing operation with this name.
            meta = meta.filter(x => x.name !== targetName);

            if (!newOperation.imports['@id']) {
                res.status(400).json({error: "cannot find .imports['@id']"});
            }

            // Only imports implemented at the moment
            let targetContext = context.getContextForURL(newOperation.imports['@id']);
            if (!getDependencyGraph(req).hasNode(targetContext.getLocalHref())) {
                res.status(400).json({error: "cannot find operation at: " + newOperation.imports['@id']});
            }

            // Add the name of the operation, and the name of imported operation
            newOperation.imports.href = targetContext.getLocalHref();
            delete newOperation.imports['@id'];
            newOperation.name = targetName;

            // Add the operation
            meta.push(newOperation);
            index.meta = meta;

            console.log('Updating '+indexPath);
            fu.writeFile(indexPath, JSON.stringify(index, null, 2));

            // Rebuild the dependency graph
            rebuildGraph(req);
            res.json({'@id': context.getCurrentPath()+'/'+targetName});
        }

        if (processorOptions.hydraOperations.indexOf('POST') !== -1) {
            this.post("*", function (req, res, next) {
                createOrUpdateFile(req, res, next);
            });
        }

        if (processorOptions.hydraOperations.indexOf('PUT') !== -1) {
            this.put("*", function (req, res, next) {
                createOrUpdateFile(req, res, next);
            });
        }

        function createOrUpdateFile(req, res, next) {
            let context = new Context(req,serverOptions);
            let targetFile = context.getLocalDir();
            fu.writeFile(targetFile, req.body);
            console.log('Writing file: '+targetFile);
            res.json({'@id': context.getCurrentPath()});
        }

        /**
         * Delete (at he moment, it only deletes operations inside a descriptor file)
         *
         * Could check for dependencies through the dependency graph, but I'm not sure how this will behave with any H-Eye interacting.
         */
        if (processorOptions.hydraOperations.indexOf('DELETE') !== -1) {
            this.delete("*", function (req, res, next) {
                let context = new Context(req,serverOptions);

                let dependencyGraph = getDependencyGraph(req);
                let hasDefinedOperation = dependencyGraph.hasNode(context.getLocalHref());

                if (!hasDefinedOperation) {

                    // Delete a turtle file
                    let targetFile = context.getLocalDir();
                    fu.deleteFileOrDirectory(targetFile);
                    res.json({deleted: {'@id': context.getCurrentPath()}});

                } else {

                    // Delete an operation
                    let targetDir = context.getTail().getLocalDir();
                    let targetName = context.getHead();

                    // check if there is a descriptor file
                    let indexPath = targetDir + '/' + serverOptions.indexFile;
                    if (!fu.exists(indexPath)) {
                        res.status(400).json({error: context.getCurrentPath() + ' has no descriptor file'});
                    }

                    // Remove existing operation with this name.
                    let index = fu.readJson(indexPath);

                    if (!index.meta) {
                        res.status(400).json({error: context.getCurrentPath() + ' has no meta-operations defined'});
                    }
                    index.meta = index.meta.filter(x => x.name !== targetName);

                    fu.writeFile(indexPath, JSON.stringify(index, null, 2));
                    // Rebuild the dependency graph
                    rebuildGraph(req);
                    res.json({deleted: {'@id': context.getCurrentPath()}});
                }
            });
        }

        /**
         * Fallback
         */
        this.get("*", function (req, res, next) {
            let targetContentType = serverOptions.defaultContentType;
            res.format({
                'application/json': function () {
                    targetContentType = 'application/x-json+ld'
                },
                'text/turtle': function () {
                    targetContentType = 'text/turtle'
                },
                'default': function () {
                    targetContentType = serverOptions.defaultContentType
                }
            });

            let context = new Context(req,serverOptions);
            let dsl_v1 = getDSL(req);

            let dependencyGraph = getDependencyGraph(req);
            let hasDefinedOperation = dependencyGraph.hasNode(context.getLocalHref());
            if (hasDefinedOperation) {
                let meta = dependencyGraph.getNodeData(context.getLocalHref());

                // Forcing a particular content type (csv)
                if (meta['Content-Type']){
                    targetContentType = meta['Content-Type'];
                }

                if (meta.href) {
                    // let target = dsl_v1.toDereferenciable(context.getLocalDir(), meta.href);
                    // let target = context.getLocalDir();
                    let targetFile = dsl_v1.toAbsolutePath(context.getLocalDir(),meta.href);
                    if (fu.exists(targetFile)&&fu.isFile(targetFile)) { // is a local file
                        let target = context.toResourcePath(targetFile);
                        let options = {
                            uri: target,
                            headers: {
                                "Accept": targetContentType
                            }
                        };
                        rp(options)
                            .then(function (body) {
                                renderSupportedContentypes(context, targetContentType, body, res);
                            })
                            .catch(function (error) {
                                renderError(res, error);
                            });
                    } else { // Its either external or virtual operation, we redirect
                        let target = dsl_v1.toDereferenciable(context.getLocalDir(), meta.href);
                        if (target.startsWith(serverOptions.workSpacePath)) { // Only to resources inside the worksPace
                            target = context.toApiPath(target);
                        }
                        res.set({"Accept": targetContentType});
                        res.redirect(target);
                    }
                } else if (meta.raw) {
                    renderSupportedContentypes(context, targetContentType, meta.raw, res);
                } else if (meta.inference) {

                    function rawToUrl(context, rawValue) {
                        let filename = hash(rawValue) + ".n3";
                        if (!fu.exists(filename)) {
                            fu.writeFile(serverOptions.workSpacePath + "/" + serverOptions.tmpFolder + "/" + filename, rawValue);
                        }
                        return context.getResourcesRoot() + "/" + serverOptions.tmpFolder + "/" + filename;
                    }
                    // Writes a temporary file to be read by Eye, I don't know yet how to handle content types in EYE
                    // Whenever is the solution to this, this shouldn't be in this layer
                    if (meta.inference.query.raw) {
                        meta.inference.query.href = rawToUrl(context, meta.inference.query.raw);
                        delete meta.inference.query.raw;
                    }

                    // Here comes the all the DAG invocation
                    Promise.resolve(reasoner.eyePromise(meta.inference))
                        .then(function (body) {
                            renderSupportedContentypes(context, targetContentType, body, res);
                        })
                        .catch(function (error) {
                            renderError(res, error);
                        });

                } else if (meta.query) {
                    // @TODO this is handling only raw.
                    let options = {
                        uri: meta.query.endpoint,
                        qs: {
                            query: meta.query.raw,
                            "default-graph-uri": meta.query['default-graph-uri']
                        },
                        headers: {
                            "Accept": "text/turtle"
                        }
                    };
                    rp(options)
                        .then(function (body) {
                            renderSupportedContentypes(context, targetContentType, body, res);
                        }).catch(function (error) {
                        renderError(res, error);
                    });

                }
            } else {
                let index = buildIndex(processorOptions,serverOptions, req, res);
                res.json(index);
            }

        });

    }

 }


/**
 * Gets the index.json file and populates it with additional info such as files.
 */
function buildIndex( processorOptions, serverOptions, req, res) {
    let context = new Context(req,serverOptions);
    let localDir = context.getLocalDir();
    let contents = fu.readDir(localDir);

    // Was not an inferred operation, we read the index
    let result = fu.readJson(localDir + '/' + serverOptions.indexFile);
    result["@id"] = context.getCurrentPath();

    // And process the meta
    if (result.meta) {
        let operations = [], currentOperation;

        // Handle build links for the operations
        for (currentOperation of _.filter(result.meta)) {
            let operationName = _.get(currentOperation, 'name');
            let operationUri = context.getCurrentPath() + '/' + operationName;
            let link = buildLink(operationUri, 'Operation');
            if (currentOperation['description']) {
                link['description'] = currentOperation['description'];
            }
            operations.push(link);
        }
        delete result.meta;
        result['this:operation'] = operations;
    }

    // Process directories
    if (processorOptions.showDirectories) {
        _.map(contents.directories,
            directory => {
                // Peek types
                let directoryIndex = fu.readJson(localDir + "/" + directory + '/' + serverOptions.indexFile);
                let type = _.get(directoryIndex, '@type', 'this:Resource');
                result["this:" + directory] = buildLink(context.getCurrentPath() + "/" + directory, type)
            }
        );
    }

    // We add the files
    if (processorOptions.showFiles) {
        function getPublicFiles(files) {
            return _.map(files.filter(filePath => !filePath.endsWith(serverOptions.indexFile)),
                filePath => buildLink(context.toResourcePath(filePath), 'Resource')
            );
        }

        if (contents.files) {
            let publicFiles = getPublicFiles(contents.files);
            if (!_.isEmpty(publicFiles)) {
                result["this:files"] = publicFiles;
            }
        }
    }

    // this confusing people
    // if (processorOptions.hydraOperations) {
    //     result["this:operations"] = processorOptions.hydraOperations;
    // }

    return result
}


function buildLink(uri, type) {
    return {
        "@id": uri,
        "@type": type
    }
}

/**
 * ContentType utils
 */

function renderError(res, error) {
    let jsonError = _.isString(error) ? {"error": error} : error;
    res.status(500).json(jsonError);
}

// This is too ugly something is wrong with this design.
function renderSupportedContentypes(context, contentType, body, res) {
    if (contentType === 'application/x-json+ld') {
        try {
            body = JSON.parse(body); // It's already Json
            body["@id"] = context.getCurrentPath();
        } catch (e) {
            body = turtle2JsonLD(body); // tries turtle to Json
            body["@id"] = context.getCurrentPath();
        }
        res.json(body);
    } else if (contentType === 'text/turtle') {
        try {   // If this succeeds, it was Json that needs to be turtle
            body = jsonld2Turtle(JSON.parse(body));
        } catch (e) {
        }
        res.header("Content-Type", contentType);
        res.end(body, 'utf-8');
    } else {
        res.header("Content-Type", contentType);
        res.end(body, 'utf-8');
    }

}

function turtle2JsonLD(body) {
    let n3Parser = new N3Parser();
    return n3Parser.toJSONLD(body);
}

function jsonld2Turtle(body) {
    let jsonLdParser = new JSONLDParser();
    return jsonLdParser.toN3(body);
}

module.exports = HES;