const express = require("express");
const Context = require("../Context");
const DSL_V1 = require("../dsl_v1");
const _ = require('lodash');

/**
 * The flare application
 */

class Flare extends express.Router {

    constructor(processorOptions, serverOptions) {
        super();

        if (!processorOptions) {
            throw new Error("must define processor options");
        }

        if (!serverOptions) {
            throw new Error("must define server options");
        }

        this.get("*", function (req, res, next) {

            let chunks = req.originalUrl.split('/');
            let currentPath = '/'+_.slice(chunks,2,chunks.length).join('/');
            let dataspacesURL = serverOptions.appEntrypoint + currentPath;
            let context = Context.byHostAndDataspacesUrl(req.host,dataspacesURL,serverOptions);

            let dsl = new DSL_V1(context);
            let graph = dsl.buildLocalDependencyGraph(serverOptions.workSpacePath);

            function ensureArray(value) {
                if (typeof value === 'string') {
                    return [value];
                } else {
                    return value;
                }
            }

            let flareStyle = [];
            let files = [];
            for (let nodeName in graph.nodes) {
                let imports = [];
                let node = graph.nodes[nodeName];
                if (node.inference) {
                    if (node.inference.data) {
                        for (let resource of ensureArray(node.inference.data)) {
                            imports.push(resource);
                            if (!files.includes(resource)) {
                                files.push(resource);
                            }
                        }
                    }
                    if (node.inference.query) {
                        for (let resource of ensureArray(node.inference.query)) {
                            imports.push(resource);
                            if (!files.includes(resource)) {
                                files.push(resource);
                            }
                        }
                    }
                }
                for (let incomingEdge of graph.incomingEdges[nodeName]) {
                    if (!imports.includes(incomingEdge)) {
                        imports.push(incomingEdge);
                    }
                }
                flareStyle.push({
                    name: nodeName,
                    size: 1,
                    imports: imports
                });
            }

            for (let file of files) {
                flareStyle.push({
                    name: file,
                    size: 1,
                    imports: []
                })
            }

            let getLabel = function (string) {
                return string.replaceAll(serverOptions.workSpacePath, '').replaceAll('.', '\/');
            };

            for (let source in flareStyle) {
                flareStyle[source].name = getLabel(flareStyle[source].name);
                for (let target in flareStyle[source].imports) {
                    flareStyle[source].imports[target] = getLabel(flareStyle[source].imports[target]);
                }
            };

            res.json(flareStyle);
        });
    }
}

module.exports = Flare;
