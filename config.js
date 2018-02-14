const path = require('path');

const workSpacePath = process.env.WORKSPACE_PATH || path.join(__dirname, './workspace');
const eyePath = process.env.EYE_PATH || "/opt/eye/bin/eye.sh";
const appEntrypoint = process.env.APP_ENTRY_POINT || "dataspaces";
const resourcesEntryPoint = process.env.RESOURCES_ENTRY_POINT || "resource";
const port = process.env.PORT || '3000';

var config = {
    serverOptions:{
        port:port,
        appEntrypoint: appEntrypoint,
        resourcesEntryPoint: resourcesEntryPoint,
        workSpacePath: workSpacePath,
        tmpFolder: "tmp",
        verbose: false,
        indexFile: 'index.json'
    },

    defaultEyeOptions:{
        eyePath: eyePath,
        defaultFlags:["--nope"]
    },

    defaultProcessorOptions:{
        showFiles:true,
        showDirectories:true,
        hydraOperations:["GET","COPY"]
    },
    defaultContext: {
        "fluid": "http://josd.github.io/fluid#",
        "hes": "http://cristianvasquez.github.io/hes#"
    },
};
module.exports = config;