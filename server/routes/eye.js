const express = require("express");
const router = express.Router();
const reasoning = require("../reasoning");
var config = require('../../config');

/**
 * Maintains part of the functionality of
 *
 * https://github.com/RubenVerborgh/EyeServer
 *
 * Data + Query
 *
 * Example:
 * http://localhost:3000/eye?data=http://eulersharp.sourceforge.net/2003/03swap/socrates.n3&query=http://eulersharp.sourceforge.net/2003/03swap/socratesF.n3
 *
 * Arbitrary command
 *
 * Example:
 * http://localhost:3000/eye?command=--version
 */
router.get("/*", function(req, res, next) {

    let data = req.query.data;
    let query = req.query.query;

    let command = req.query.command;
    if (command){
        // A direct command to the eye reasoner
        res.header('Access-Control-Allow-Origin', '*');
        Promise.resolve(reasoning.invokeEye(config.eyePath+' '+command,true))
            .then(function (result) {
                res.json(result);
            })
            .catch(function (error) {
                res.json({error:error});
            });
    } else {
        // Common case, multiple data URLs and a query
        if (!data) return res.sendStatus(400);
        if (!query) return res.sendStatus(400);

        // make sure data is an array
        if (typeof(data) === 'string'){
            data = data.split(',');
        }
        res.header('Access-Control-Allow-Origin', '*');
        Promise.resolve(reasoning.eyePromise(data,query))
            .then(function (result) {
                res.send(result);
            })
            .catch(function (error) {
                res.json({error:error});
            });
    }
});

module.exports = router;