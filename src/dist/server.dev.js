"use strict";

var http = require("http");

var _require = require("crypto"),
    createHash = _require.createHash;

var GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
var app = http.createServer(function (req, res) {
  res.end("hello");
});
app.on("upgrade", function (req, socket, head) {
  var key = req.headers["sec-websocket-key"];
  var version = +req.headers["sec-websocket-version"];
  var digest = createHash("sha1").update("".concat(key).concat(GUID)).digest("base64");
  var headers = ["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", "Sec-WebSocket-Accept: ".concat(digest)];
  console.log(digest);
  socket.write(headers.concat("\r\n").join("\r\n"));
  console.log("upgrade");
  socket.on("data", function (d) {
    // TODO 解析
    console.log(d);
  });
});
app.listen(8080);