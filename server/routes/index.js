const Context = require("../Context");
const express = require("express");
const router = express.Router();

router.get("/", function(req, res, next) {
     res.redirect(new Context(req).getApiRoot());
});

module.exports = router;