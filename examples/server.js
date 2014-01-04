connect = require('connect');

var srvDir = __dirname + '/..',
    port   = 7123;

console.log("Now serving examples:  http://localhost:7123/examples");
connect.createServer(
    connect.static(srvDir)
).listen(port);
