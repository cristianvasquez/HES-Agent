const path = require('path');

const workSpacePath = process.env.WORKSPACE_PATH || path.join(__dirname, './workspace');
const eyePath = process.env.EYE_PATH || "/opt/eye/bin/eye.sh";
const appEntrypoint = process.env.APP_ENTRY_POINT || "dataspaces";
const resourcesEntryPoint = process.env.RESOURCES_ENTRY_POINT || "resource";
const port = process.env.PORT || '3000';

var config = {

    schemas:{
        metaOperationSchema:path.join(__dirname, './schemas/dsl_v1_meta.schema.json')
    },

    serverOptions:{
        // uriqa:"www.example.com",
        port:port,
        appEntrypoint: appEntrypoint,
        resourcesEntryPoint: resourcesEntryPoint,
        workSpacePath: workSpacePath,
        verbose: false,
        indexFile: 'index.json',
    },

    defaultEyeOptions:{
        command_arguments: {maxBuffer: 1024 * 500},
        eyePath: eyePath,
        defaultFlags:["--nope"]
    },

    defaultProcessorOptions:{
        showFiles:true,
        showDirectories:true,
        defaultContentType:"application/x-json+ld",
        hydraOperations:["POST","PUT","DELETE"]
    },

    defaultContext: {
        "@vocab": "http://example.org#",
        "fluid": "http://josd.github.io/fluid#",
        "hes": "http://cristianvasquez.github.io/hes#"
    },
};

module.exports = config;
