const config = require("../../config");
const resolve = require("../resolve");

var express = require("express");
var router = express.Router();

router.get("/", function(req, res, next) {
    res.json(
        {
            api:resolve.apiPath(req)
        }
    );
});

module.exports = router;