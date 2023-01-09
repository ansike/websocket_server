const http = require("http");
const { createHash } = require("crypto");
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const app = http.createServer((req, res) => {
  res.end("hello");
});

app.on("upgrade", (req, socket, head) => {
  const key = req.headers["sec-websocket-key"];
  const version = +req.headers["sec-websocket-version"];
  const digest = createHash("sha1").update(`${key}${GUID}`).digest("base64");

  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${digest}`,
  ];
  console.log(digest);
  socket.write(headers.concat("\r\n").join("\r\n"));

  console.log("upgrade");
  socket.on("data", (d) => {
    // TODO 解析
    console.log(d);
  });
});
app.listen(8080);
