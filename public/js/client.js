const socket = io.connect()
let processor = null
let localstream = null

socket.on('stt text', (resText) => {
    console.log(resText)
    document.getElementById("submitMessage").value = resText
});

/*
送信機能はないため
エンターキーを押したときのみhtmlをコピーして表示している
*/
let chkCnt = 0
const pushKey = () =>{
    document.addEventListener("keydown", event => {
        if(event.keyCode === 13){
            const inputText = document.getElementById("submitMessage").value;
            if(!inputText.match(/\S/g))return;
            if(!inputText)return;
            document.getElementById("submitMessage").value = ''
            chkCnt++;
            if(chkCnt === 1){
                addText(inputText);
            }
        }
    });
    chkCnt = 0;
}


const addText = (text) => {
    let contentArea = document.getElementById("message-content");
    let newElem = document.createElement("div");
    newElem.className = "message-area you";
    childElem = document.createElement("div");
    childElem.className = "message"
    childElem.innerHTML = text
    newElem.appendChild(childElem)
    contentArea.appendChild(newElem)
}


function startRecording() {
    console.log('start recording')
    context = new window.AudioContext()
    socket.emit('start', { 'sampleRate': context.sampleRate })

    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
        localstream = stream
        const input = this.context.createMediaStreamSource(stream)
        processor = context.createScriptProcessor(4096, 1, 1)

        input.connect(processor)
        processor.connect(context.destination)

        processor.onaudioprocess = (e) => {
            const voice = e.inputBuffer.getChannelData(0)
            socket.emit('send_pcm', voice.buffer)
        }
    }).catch((e) => {
        console.log(e)
    })
}


function stopRecording() {
    console.log('stop recording')
    processor.disconnect()
    processor.onaudioprocess = null
    processor = null
    localstream.getTracks().forEach((track) => {
        track.stop()
    })
    socket.emit('stop', '', (res) => {
        console.log(`Audio data is saved as ${res.filename}`)
    })
}


const toggleRecord = () => {
    if(document.getElementById("record-Btn").textContent === "録音開始"){
        document.getElementById("record-Btn").textContent = "録音中";
        startRecording();
    }else{
        document.getElementById("record-Btn").textContent = "録音開始";
        stopRecording();
    }
}