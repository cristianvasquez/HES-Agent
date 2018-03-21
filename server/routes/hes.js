const express = require("express");
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const JSONLDParser = require('../lib/N3Parser/JSONLDParser');
const Context = require("../Context");
const reasoner = require("../reasoning");
const DSL_V1 = require("../dsl_v1");
const rp = require('request-promise');
const handlebars = require('handlebars');

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

        // let dependencyGraph = undefined;
        function getDependencyGraph(req) {
            let context = new Context(req, serverOptions);
            let dsl = new DSL_V1(context);
            return dsl.buildLocalDependencyGraph(serverOptions.workSpacePath);
            // if (!dependencyGraph){
            //     rebuildGraph(req);
            // }
            // return dependencyGraph;
        }
        // @TODO look for better cache strategies for the dependency graph, this one is just dangerous
        // function rebuildGraph(req){
        //     let context = new Context(req, serverOptions);
        //     let dsl = new DSL_V1(context);
        //     dependencyGraph = dsl.buildLocalDependencyGraph(serverOptions.workSpacePath);
        // }

        function getDependencyGraphAtPath(req, res, next){
            // rebuildGraph(req);
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
            return graph;
        }


        /**
         * Exports metadata about the operations on a given URL
         */
        this.get("*/dependencies", function (req, res, next) {
            let graph = getDependencyGraphAtPath(req,res,next);

            for (let nodePath in graph.nodes){
                if (graph.nodes[nodePath].inference){
                    graph.nodes[nodePath].eyeCall = reasoner.getEyeCommand(graph.nodes[nodePath].inference);
                }
            }
            res.json(graph);
        });

        this.get("*/flare", function (req, res, next) {
            let graph = getDependencyGraphAtPath(req,res,next);
            function ensureArray(value){
                if (typeof value === 'string'){
                    return [value];
                } else {
                    return value;
                }
            }
            let flareStyle = [];
            let files = [];
            for (let nodeName in graph.nodes){
                let imports = [];
                let node = graph.nodes[nodeName];
                if (node.inference){
                    if (node.inference.data){
                        for (let resource of ensureArray(node.inference.data)){
                            imports.push(resource);
                            if (!files.includes(resource)){
                                files.push(resource);
                            }
                        }
                    }
                    if (node.inference.query){
                        for (let resource of ensureArray(node.inference.query)){
                            imports.push(resource);
                            if (!files.includes(resource)){
                                files.push(resource);
                            }
                        }
                    }
                }
                for (let incomingEdge of graph.incomingEdges[nodeName]){
                    if (!imports.includes(incomingEdge)){
                        imports.push(incomingEdge);
                    }
                }
                flareStyle.push({
                    name:nodeName,
                    size:1,
                    imports:imports
                });
            }
            for (let file of files){
                flareStyle.push({
                    name:file,
                    size:1,
                    imports:[]
                })
            }

            let getLabel = function(string){
                return string.replaceAll(serverOptions.workSpacePath,'').replaceAll('.','\/');
            };

            for (let source in flareStyle){
                flareStyle[source].name = getLabel(flareStyle[source].name);
                for (let target in flareStyle[source].imports){
                    flareStyle[source].imports[target]=getLabel(flareStyle[source].imports[target]);
                }
            };

            res.json(flareStyle);
        });

        if (processorOptions.hydraOperations.indexOf('POST') !== -1) {
            this.post("*/dependencies", function (req, res, next) {
                res.status(500).json({error: 'Not available anymore'});
            });
        }

        if (processorOptions.hydraOperations.indexOf('PUT') !== -1) {
            this.put("*/dependencies", function (req, res, next) {
                res.status(500).json({error: 'Not available anymore'});
            });
        }

        this.get("*/discover", function (req, res, next) {
            let context = new Context(req,serverOptions);
            let operations = [];
            let graph = getDependencyGraphAtPath(req,res,next);

            for (let nodePath in graph.nodes){
                let current = buildLink(context.getApiRoot()+nodePath, 'Feature');
                if (graph.nodes[nodePath].description){
                    current.description =graph.nodes[nodePath].description;
                }
                operations.push(current);
            }
            res.json({
                "@context": {
                    "@base": "http://www.example.org#"
                },
                'features': operations
            });
        });

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
                if (typeof meta !== 'string' && meta['Content-Type']){
                    targetContentType = meta['Content-Type'];
                }

                if (typeof meta === 'string') {
                    let targetFile = dsl_v1.toAbsolutePath(context.getLocalDir(),meta);
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
                        let target = dsl_v1.toDereferenciable(context.getLocalDir(), meta);
                        if (target.startsWith(serverOptions.workSpacePath)) { // Only to resources inside the worksPace
                            target = context.toApiPath(target);
                        }
                        res.set({"Accept": targetContentType});
                        res.redirect(target);
                    }
                } else if (meta.raw) {
                    renderSupportedContentypes(context, targetContentType, meta.raw, res);
                } else if (meta.inference) {

                    // Here comes the all the DAG invocation
                    Promise.resolve(reasoner.eyePromise(meta.inference))
                        .then(function (body) {
                            renderSupportedContentypes(context, targetContentType, body, res);
                        })
                        .catch(function (error) {
                            renderError(res, error);
                        });

                } else if (meta.query) {
                    let options = {
                        uri: meta.query.endpoint,
                        qs: {
                            query: fu.readFile(meta.query.sparql),
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

                }else if (meta.handlebars) {
                    // @TODO precompile templates
                    let source = fu.readFile(context.getLocalDirForResource(meta.handlebars));
                    let template = handlebars.compile(source);
                    let data = meta.context;
                    let body = template(data);
                    renderSupportedContentypes(context, targetContentType, body, res);
                } else {
                    res.status(500).json({
                        "message":"cannot interpret meta",
                        "meta":meta
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
    if (result.features) {
        let operations = [];

        for (operationName in result.features) {
            let operationUri = context.getCurrentPath() + '/' + operationName;
            let link = buildLink(operationUri, 'Operation');
            let currentOperation = result.features[operationName];
            if (currentOperation['description']) {
                link['description'] = currentOperation['description'];
            }
            operations.push(link);
        }

        delete result.features;
        result['operation'] = operations;
    }

    // Process directories
    if (processorOptions.showDirectories) {
        _.map(contents.directories,
            directory => {
                // Peek types
                let directoryIndex = fu.readJson(localDir + "/" + directory + '/' + serverOptions.indexFile);
                let type = _.get(directoryIndex, '@type', 'Resource');
                result[directory] = buildLink(context.getCurrentPath() + "/" + directory, type)
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
                result["files"] = publicFiles;
            }
        }
    }

    // result["discover"] = buildLink(context.getCurrentPath()+'/discover', 'Container');
    result["debug"] = buildLink(context.getCurrentPath()+'/dependencies', 'DebugEndpoint') ;

    return result
}


function buildLink(uri, type) {
    return {
        "@id": uri,
        "@type": type
    }
}

/**
 * ContentType utils. @TODO re-think and revisit this!
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