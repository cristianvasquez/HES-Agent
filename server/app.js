let express = require('express');
let path = require('path');
let logger = require('morgan');
let cookieParser = require('cookie-parser');

let getAgent = function(config){
    let app = express();
    let bodyParser = require('body-parser');
    app.use(bodyParser.text());
    app.use(bodyParser.text({ type: 'application/x-json+ld' }));
    app.use(bodyParser.text({ type: 'text/turtle' }));
    app.use(bodyParser.text({ type: 'text/n3' }));

    app.use(logger('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    const index = require('./routes/index');
    const HES = require('./routes/hes');
    const Flare = require('./routes/flare');

    app.use('/', index);
    app.use('/'+ config.serverOptions.resourcesEntryPoint, express.static(config.serverOptions.workSpacePath) );
    app.use('/'+ config.serverOptions.appEntrypoint, new HES(config.processorOptions,config.serverOptions) );
    app.use('/flare', new Flare(config.processorOptions, config.serverOptions));
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
    return app;
};

module.exports = getAgent;