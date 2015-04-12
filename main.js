// https://www.digitalocean.com/community/tutorials/how-to-create-an-ssl-certificate-on-nginx-for-ubuntu-14-04
// openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx.key -out nginx.crt

var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    express = require('express');

var port = 8000;

var options = {
    key: fs.readFileSync('./nginx.key'),
    cert: fs.readFileSync('./nginx.crt'),
    requestCert: false,
    rejectUnauthorized: false
};

var app = express();

var server = https.createServer(options, app).listen(port, function(){
  console.log("Express server listening on port " + port);
});

// app.get('/', function (req, res) {
//     res.writeHead(200);
//     res.end("hello world\n");
// });

app.use(express.static(__dirname + '/public'))
