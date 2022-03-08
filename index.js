#!/bin/bash

const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');

const app = express();
app.use(express.static(__dirname));

https.createServer({
    key: fs.readFileSync('cert/localhost-key.pem'),
    cert: fs.readFileSync('cert/localhost.pem'),
}, app)
    .listen(443)
console.log('Server running on https://localhost:443');