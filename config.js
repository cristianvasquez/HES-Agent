const path = require('path');

const workSpacePath = process.env.WORKSPACE_PATH || path.join(__dirname, './workspace');
const eyePath = process.env.EYE_PATH || "eye";
const appEntrypoint = process.env.APP_ENTRY_POINT || "dataspaces";
const resourcesEntryPoint = process.env.RESOURCES_ENTRY_POINT || "resource";
const port = process.env.PORT || '3000';

var config = {
    serverOptions:{
        port:port,
        appEntrypoint: appEntrypoint,
        resourcesEntryPoint: resourcesEntryPoint,
        workSpacePath: workSpacePath,
        verbose: false,
        indexFile: 'index.json'
    },

    defaultEyeOptions:{
        eyePath: eyePath
    },

    defaultProcessorOptions:{
        showFiles:true,
        showDirectories:true,
        hydraOperations:["GET","DELETE","COPY"]
    },
    defaultContext: {
        "hydra": "http://www.w3.org/ns/hydra/core#",
        "fluid": "http://josd.github.io/fluid#",
        "hes": "http://cristianvasquez.github.io/hes#"
    },
};
module.exports = config;