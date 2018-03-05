const Context = require("../Context");
const express = require("express");
const router = express.Router();
const defaultServerOptions = require("../../config").serverOptions;

router.get("/", function(req, res, next) {
     res.redirect(new Context(req,defaultServerOptions).getApiRoot());
});

module.exports = router;