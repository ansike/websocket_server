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
    const data = decodeWsData(d);
    console.log(data.payloadData?.toString());
  });
});
app.listen(8080);

function decodeWsData(data) {
  let start = 0;
  let frame = {
    isFinal: (data[start] & 0x80) === 0x80,
    opcode: data[start++] & 0xf,
    masked: (data[start] & 0x80) === 0x80,
    payloadLen: data[start++] & 0x7f,
    maskingKey: "",
    payloadData: null,
  };

  console.log(frame);
  if (frame.payloadLen === 126) {
    frame.payloadLen = (data[start++] << 8) + data[start++];
  } else if (frame.payloadLen === 127) {
    frame.payloadLen = 0;
    for (let i = 7; i >= 0; i--) {
      frame.payloadLen += data[start++] << (i * 8);
    }
  }
  if (frame.payloadLen) {
    if (frame.masked) {
      const maskingKey = [
        data[start++],
        data[start++],
        data[start++],
        data[start++],
      ];
      frame.maskingKey = maskingKey;
      frame.payloadData = data
        .slice(start, start + frame.payloadLen)
        .map((byte, idx) => {
          return byte ^ maskingKey[idx % 4];
        });
    } else {
      frame.payloadData = data.slice(start, start + frame.payloadLen);
    }
  }
  return frame;
}
