const path = require('path');

const workSpacePath = process.env.WORKSPACE_PATH || path.join(__dirname, './workspace');
const eyePath = process.env.EYE_PATH || "eye";
const appEntrypoint = process.env.APP_ENTRY_POINT || "dataspaces";
const resourcesEntryPoint = process.env.RESOURCES_ENTRY_POINT || "resource";
const port = process.env.PORT || '3000';

var config = {
    port:port,
    appEntrypoint: appEntrypoint,
    resourcesEntryPoint: resourcesEntryPoint,
    workSpacePath: workSpacePath,

    indexFile: 'index.json',
    eyePath: eyePath,
    verbose: false,

    defaultContext: {
        "@vocab": "http://josd.github.io/fluid#",
        "hydra": "http://www.w3.org/ns/hydra/core#",
        "gps": "http://josd.github.io/fluid/gps/gps-schema#",
        "this": "http://localhost/ephemereal#"
    }

};

module.exports = config;