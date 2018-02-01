const serverOptions = require("../../config").serverOptions;
const express = require("express");
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const Context = require("../Context");
const reasoner = require("../reasoning");
const dsl_v1 = require("../dsl_v1");
const rp = require('request-promise');
let hash = require('string-hash');

class HES extends express.Router {

    constructor(processorOptions) {
        super();

        if (!processorOptions) {
            throw new Error("must define processor options example: " + JSON.stringify(config.processorOptions, null, 2));
        }

        this.processorOptions = processorOptions;

        /**
         * Some operations (I don't have a clear idea yet of which ones to support)
         */
        if (this.processorOptions.hydraOperations.indexOf('COPY')) {
            this.post("*", function (req, res, next) {

                /**
                 * hes:extends
                 *
                 * Extends the contents of one path
                 *
                 * Example body:
                  {
                    "hes:extends":{
                        "@id": "http://localhost:3000/gps4ic/serviceDefinitions/T0/step_3"
                        "hes:name":"newCall
                    }
                  }
                 */
                let context = new Context(req);

                let operation = req.body['hes:extends'];
                if (!operation) {
                    res.writeHead(400);
                    res.json({error:"cannot recognize operation"});
                }

                let localDir = context.getLocalDir();
                let index = fu.readJson(localDir + '/' + serverOptions.indexFile);
                let targetContext = context.getContextForURL(operation['@id']);

                let metaOperation = {
                    "hes:name":operation['hes:name'],
                    "hes:extends": {
                        "hes:href": targetContext.tail().getLocalHref(),
                        "hes:name": targetContext.head()
                    }
                };
                index['hes:meta'].push(metaOperation);
                res.json(index);

            });
        }

        /**
         * Delete
         */
        if (this.processorOptions.hydraOperations.indexOf('DELETE')) {
            this.delete("*", function (req, res, next) {
                if (this.processorOptions.hydraOperations) {
                    let context = new Context(req);
                    let localDir = context.getLocalDir();
                    if (!fu.exists(localDir)) return res.sendStatus(400);
                    fu.deleteDirectory(localDir);
                    res.json(
                        {
                            "status": {
                                "deleted": context.getCurrentPath()
                            }
                        }
                    )
                }
            });
        }

        /**
         * Fallback
         */
        this.get("*", function (req, res, next) {
            let context = new Context(req);
            let virtuals = handleVirtuals(context);
            if (virtuals.isVirtual) {
                // Handle the corresponding virtual
                virtuals.callback(res)
            } else {
                // Build the default index.
                let index = buildIndex(processorOptions, req, res);
                res.json(index);
            }
        });

    }
}

function handleHref(context, value) {
    let target = dsl_v1.normalizeHref(context.getTail().getLocalDir(), value);
    return {
        isVirtual: true,
        callback: function (res) {
            res.redirect(context.toApiPath(target));
        }
    }
}

// "hes:query": {
//     "hes:endpoint": "http://dbpedia.restdesc.org/",
//     "hes:defaultGraph": "http://dbpedia.org",
//     "hes:raw": "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } limit 10",
//     "hes:output": "text/turtle"
// }
function handleQuery(context, query) {
    let contentType = query['hes:Accept'];
    var options = {
        uri: query['hes:endpoint'],
        qs: {
            query: query['hes:raw'],
            "default-graph-uri": query['hes:default-graph-uri']
        },
        headers: {
            "Accept": contentType
        }
    };
    console.log(toJson(options));
    return {
        isVirtual: true,
        callback: function (res) {
            rp(options)
                .then(function (response) {
                    res.writeHead(200, {'Content-Type': contentType});
                    res.end(response, 'utf-8');
                })
                .catch(function (error) {
                    res.json({error: error});
                });
        }
    };
}

function rawToUrl(context, rawValue) {
    let filename = hash(rawValue)+".ttl";
    if (!fu.exists(filename)){
        fu.writeFile(serverOptions.workSpacePath + "/" + serverOptions.tmpFolder + "/" + filename, rawValue);
    }
    return context.getResourcesRoot() + "/" + serverOptions.tmpFolder + "/"+filename;
}

function handleInference(context, inference) {

    // Writes a temporary file to be read by Eye
    if (inference['hes:query']['hes:raw']) {
        inference['hes:query']['hes:href'] = rawToUrl(context, inference['hes:query']['hes:raw']);
        delete inference['hes:query']['hes:raw'];
    }

    // We found a inference operation, we invoke the eye reasoner
    let eyeOptions = dsl_v1.getEyeOptions(context.getTail().getLocalDir(), inference);

    function defaultMediatype(body, res) {
        let result = body2JsonLD(body);
        result["@id"] = context.getCurrentPath();
        res.json(result);
    }

    return {
        isVirtual: true,
        callback: function (res) {
            Promise.resolve(reasoner.eyePromise(eyeOptions))
                .then(function (body) {
                    let contentType='application/x-json+ld';
                    if(inference["hes:Accept"]){
                        contentType=inference["hes:Accept"];
                    }
                    if (contentType==='application/x-json+ld'){
                        defaultMediatype(body,res);
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(body, 'utf-8');
                    }
                })
                .catch(function (error) {
                    res.json({error: error});
                });
        }
    };
}

function handleVirtuals(context) {
    let localDir = context.getLocalDir();
    let exists = fu.exists(localDir);
    // Could be it is an inferred directory, or a link
    // We check the parent if there are defined operations
    if (!exists && context.getCurrentPath().length > context.getApiRoot().length) {
        let operationId = context.getHead();
        let localDir = context.getTail().getLocalDir();
        let index = fu.readJson(localDir + '/' + serverOptions.indexFile);
        if (index['hes:meta']) {
            for (let operation of index['hes:meta']) {
                if (operation['hes:name'] === operationId) {
                    // The operation exists, therefore needs to be handled.
                    return doOperation(context, operation);
                }
            }
        }
    }
    return {
        isVirtual: false
    };
}

function doOperation(context, operation) {
    // Expands operations and transform extends to regular operations
    let _operation = dsl_v1.expandMeta(context.getTail().getLocalDir(),operation);
    if (_operation['hes:href']) {
        return handleHref(context, _operation['hes:href'])
    } else if (_operation['hes:inference']) {
        return handleInference(context, _operation['hes:inference']);
    } else if (_operation['hes:query']) {
        return handleQuery(context, _operation['hes:query']);
    }
    throw new Error("Cannot handle " + toJson(_operation));
}


/**
 * Gets the index.json file and populates it with additional info such as files.
 */
function buildIndex(processorOptions, req, res) {
    let context = new Context(req);
    let localDir = context.getLocalDir();
    let contents = fu.readDir(localDir);

    // Was not an inferred operation, we read the index
    let result = fu.readJson(localDir + '/' + serverOptions.indexFile);
    result["@id"] = context.getCurrentPath();

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

    // And process the meta
    if (result['hes:meta']) {
        let operations = [], currentOperation;

        // Handle build links for the operations
        for (currentOperation of _.filter(result['hes:meta'])) {
            let operationName = _.get(currentOperation, 'hes:name');
            let operationUri = context.getCurrentPath() + '/' + operationName;
            let link = buildLink(operationUri, 'Operation');
            if (currentOperation['hes:description']) {
                link['hes:description'] = currentOperation['hes:description'];
            }
            operations.push(link);
        }
        delete result['hes:meta'];
        result['this:operation'] = operations;
    }

    if (processorOptions.hydraOperations) {
        result["hydra:operations"] = processorOptions.hydraOperations;
    }

    return result
}


function buildLink(uri, type) {
    return {
        "@id": uri,
        "@type": type
    }
}

function toJson(x) {
    return JSON.stringify(x, null, 2);
}

function body2JsonLD(body) {
    let n3Parser = new N3Parser();
    let jsonLd = n3Parser.toJSONLD(body);
    let eyeResponse = JSON.stringify(jsonLd, null, 4);
    return JSON.parse(eyeResponse);
}

module.exports = HES;