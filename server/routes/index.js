const resolve = require("../resolve");
const express = require("express");
const router = express.Router();

router.get("/", function(req, res, next) {
     res.redirect(resolve.apiPath(req));
});

module.exports = router;