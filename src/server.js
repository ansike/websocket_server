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
    const content = data.payloadData?.toString();
    console.log(content);
    socket.write(encodeWsData({ payloadData: `server get data: ${content}` }));
  });
});
app.listen(8080);

// https://www.rfc-editor.org/rfc/rfc6455#page-27
function decodeWsData(data) {
  let start = 0;
  let frame = {
    // 第一个byte 第一bit判断是否是结束祯。和0x80与（128=>10000000）之后可以判断该位的值，1为true，0为false
    isFinal: (data[start] & 0x80) === 0x80,
    // 第一个byte 后4bits判断 opcode。和0xf与（15=>00001111）之后获取到该位的值
    /*0x1 denotes a text frame
      0x2 denotes a binary frame
      0x3-7 are reserved for further non-control frames
      0x8 denotes a connection close
      0x9 denotes a ping
      0xA denotes a pong
      */
    opcode: data[start++] & 0xf,
    // 第二个byte（上一行start位已经移动到下一个byte），第一位判断是否masked。和0x80与（128=>10000000）之后可以判断该位的值，1为true，0为false。之后不再赘述
    masked: (data[start] & 0x80) === 0x80,
    // 第二个byte，后7bits判断payload的长度，当然下边还有 Extended payload length
    payloadLen: data[start++] & 0x7f,
    maskingKey: [],
    payloadData: null,
  };

  // if 0-125, that is the payload length
  // If 126, the following 2 bytes interpreted as a 16-bit unsigned integer are the payload length.
  // If 127, the following 8 bytes interpreted as a 64-bit unsigned integer are the payload length.
  if (frame.payloadLen === 126) {
    frame.payloadLen = (data[start++] << 8) + data[start++];
  } else if (frame.payloadLen === 127) {
    frame.payloadLen = 0;
    for (let i = 7; i >= 0; i--) {
      frame.payloadLen += data[start++] << (i * 8);
    }
  }

  // 此时有了真实的length 就可对数据进行切割 decode了
  if (frame.payloadLen) {
    if (frame.masked) {
      // payloadLen的后4个bytes就是Masking-key
      frame.maskingKey = [
        data[start++],
        data[start++],
        data[start++],
        data[start++],
      ];
      frame.payloadData = data
        .slice(start, start + frame.payloadLen)
        // masking-key-octet-j = i MOD 4
        // transformed-octet-i = original-octet-i XOR masking-key-octet-j （XOR => exclusive OR）
        .map((byte, idx) => {
          return byte ^ frame.maskingKey[idx % 4];
        });
    } else {
      // 不需要解码，直接切割即可
      frame.payloadData = data.slice(start, start + frame.payloadLen);
    }
  }
  return frame;
}

// server encode 不再需要mask，但装配数据的过程和decode类似
function encodeWsData(data) {
  let frame = [];
  // 转换成buffer
  const payload = data.payloadData ? Buffer.from(data.payloadData) : null;
  const length = payload.length;
  const isFinal = data.isFinal ?? true;
  const opcode = data.opcode ?? 1;

  // 第一个byte是FIN和opcode的组合
  if (isFinal) {
    frame.push((1 << 7) + opcode);
  } else {
    frame.push(opcode);
  }
  // 第2或2-3或2-9个byte描述data length
  if (length < 126) {
    frame.push(length);
  } else if (length < 0xffff) {
    frame.push(126, length >> 8, length & 0xff);
  } else {
    frame.push(127)
    for (let i = 7; i >= 0; i--) {
      frame.push(length & ((0xff << (i * 8)) >> (i * 8)));
    }
  }
  frame = data.payloadData
    ? Buffer.concat([Buffer.from(frame), payload])
    : Buffer.from(frame);
  return frame;
}
