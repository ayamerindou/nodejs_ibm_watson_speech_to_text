const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const fs = require('fs');
const app = express();
const { IamAuthenticator } = require('ibm-watson/auth');
const WavEncoder = require('wav-encoder');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');


const speechToText = new SpeechToTextV1({
  authenticator: new IamAuthenticator({
    apikey: '{API_KEY}',
  }),
  serviceUrl: '{SERVICE_URL}',
});


app.use('/', express.static(path.join(__dirname, 'public')));

server = http.createServer(app).listen(3000, function() {
    console.log('Example app listening on port 3000')
});

// WebSocket サーバを起動
const io = socketio(server);


// クライアントが接続したときの処理
io.on('connection', (socket) => {
    let sampleRate = 48000
    let buffer = []

    // 録音開始の合図を受け取ったときの処理
    socket.on('start', (data) => {
        sampleRate = data.sampleRate
        console.log(`Sample Rate: ${sampleRate}`)
    })

    // PCM データを受信したときの処理
    socket.on('send_pcm', (data) => {
        // data: { "1": 11, "2": 29, "3": 33, ... }
        const itr = data.values()
        const buf = new Array(data.length)
        for (var i = 0; i < buf.length; i++) {
            buf[i] = itr.next().value
        }
        buffer = buffer.concat(buf)
    })

    // 録音停止の合図を受け取ったときの処理
    socket.on('stop', (data, ack) => {
        const f32array = toF32Array(buffer)

        // 変数を初期化
        buffer = []

        const filename = `public/wav/${String(Date.now())}.wav`
        exportWAV(f32array, sampleRate, filename);
        ack({ filename: filename });
    })
})

// Convert byte array to Float32Array
const toF32Array = (buf) => {
    const buffer = new ArrayBuffer(buf.length)
    const view = new Uint8Array(buffer)
    for (var i = 0; i < buf.length; i++) {
        view[i] = buf[i]
    }
    return new Float32Array(buffer)
}

// data: Float32Array
// sampleRate: number
// filename: string
const exportWAV = (data, sampleRate, filename) => {
    const audioData = {
        sampleRate: sampleRate,
        channelData: [data]
    }
    WavEncoder.encode(audioData).then((buffer) => {
        fs.writeFile(filename, Buffer.from(buffer), (e) => {
            if (e) {
                console.log(e)
            } else {
                console.log(`start transcription ${filename}`)
                stt(filename)
            }
        })
    })
}


const sttResponse = (resText) => {
    console.log(resText)
    io.emit('stt text', resText);
}


const stt = (filename) => {
    const params = {
        objectMode: true,
        contentType: 'audio/wav',
        model: 'ja-JP_BroadbandModel',
        maxAlternatives: 1,
    };
    let responseData = '';

    const recognizeStream = speechToText.recognizeUsingWebSocket(params);
    fs.createReadStream(filename).pipe(recognizeStream);

    recognizeStream.on('data', function(event) { onEvent('Data:', event); });
    recognizeStream.on('error', function(event) { onEvent('Error:', event); });
    recognizeStream.on('close', function(event) { onEvent('Close:', event); });

    // Display events on the console.
    function onEvent(name, event) {
        if(name === 'Data:' && event['results'].length !== 0){
            responseData = event['results'][0]['alternatives'][0]['transcript'];
            sttResponse(responseData);
        }
    }
}