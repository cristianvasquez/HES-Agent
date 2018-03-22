let express = require('express');
let path = require('path');
let logger = require('morgan');
let cookieParser = require('cookie-parser');

let app = express();

// Adds text/plain and text/turtle parsing
let bodyParser = require('body-parser');

app.use(bodyParser.text());
app.use(bodyParser.text({ type: 'application/x-json+ld' }));
app.use(bodyParser.text({ type: 'text/turtle' }));
app.use(bodyParser.text({ type: 'text/n3' }));

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let serverOptions = require("../config").serverOptions;
let defaultProcessorOptions = require("../config").defaultProcessorOptions;
let defaultServerOptions = require("../config").serverOptions;

let index = require('./routes/index');
const HES = require('./routes/hes');
const Flare = require('./routes/flare');

app.use('/', index);
app.use('/'+ serverOptions.resourcesEntryPoint, express.static(serverOptions.workSpacePath));
app.use('/'+ serverOptions.appEntrypoint, new HES(defaultProcessorOptions,defaultServerOptions));
app.use('/flare', new Flare(defaultProcessorOptions,defaultServerOptions));
app.use('/apps', express.static(path.join(__dirname, './apps')));

app.set('trust proxy', '127.0.0.1');

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = err; // req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    // res.render('error');
    res.json({
        "error": err.message,
        "error.status" : err.status,
        "error.stack" : err.stack
    })
});

// Globals
String.prototype.replaceAll = function(search, replacement) {
    let target = this;
    return target.split(search).join(replacement);
};

if (serverOptions.verbose){

    function print (path, layer) {
        if (layer.route) {
            layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))))
        } else if (layer.name === 'router' && layer.handle.stack) {
            layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))))
        } else if (layer.method) {
            console.log('%s /%s',
                layer.method.toUpperCase(),
                path.concat(split(layer.regexp)).filter(Boolean).join('/'))
        }
    }

    function split (thing) {
        if (typeof thing === 'string') {
            return thing.split('/')
        } else if (thing.fast_slash) {
            return ''
        } else {
            let match = thing.toString()
                .replace('\\/?', '')
                .replace('(?=\\/|$)', '$')
                .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
            return match
                ? match[1].replace(/\\(.)/g, '$1').split('/')
                : '<complex:' + thing.toString() + '>'
        }
    }

    console.log('\nRoutes:');
    app._router.stack.forEach(print.bind(null, []))
}

module.exports = app;
