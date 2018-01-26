const resolve = require("../resolve");

var express = require("express");
var router = express.Router();

router.get("/", function(req, res, next) {
    // res.redirect(resolve.apiPath(req));
    res.json(
        {
            api:resolve.apiPath(req)
        }
    );
});

module.exports = router;