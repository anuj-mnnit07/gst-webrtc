
var elementToRecord = document.getElementById('video-container');
var canvas2d = document.getElementById('recordingCanvas');
var downloadRecordingButton = document.getElementById('downloadRecording')

var context = canvas2d.getContext('2d');

canvas2d.width = elementToRecord.clientWidth;
canvas2d.height = elementToRecord.clientHeight;

var isRecordingStarted = false;
var isStoppedRecording = false;

(function looper() {
    if(!isRecordingStarted) {
        return setTimeout(looper, 500);
    }
  
    html2canvas(elementToRecord).then(function(canvas) {
        context.clearRect(0, 0, canvas2d.width, canvas2d.height);
        context.drawImage(canvas, 0, 0, canvas2d.width, canvas2d.height);
  
        if(isStoppedRecording) {
            return;
        }
  
        requestAnimationFrame(looper);
    });
  })();
  
  var recorder = new RecordRTC(canvas2d, {
    type: 'canvas'
  });

  document.getElementById('startRecording').onclick = function() {
    this.disabled = true;
    
    isStoppedRecording =false;
    isRecordingStarted = true;
  
    recorder.startRecording();
    document.getElementById('stopRecording').disabled = false;
  };
  
  document.getElementById('stopRecording').onclick = function() {
    this.disabled = true;
    
    recorder.stopRecording(function() {
        isRecordingStarted = false;
        isStoppedRecording = true;
  
        var blob = recorder.getBlob();
        recorder.src = URL.createObjectURL(blob);
        downloadRecordingButton.href = recorder.src;
        downloadRecordingButton.download = "RecordedVideo.webm";
    });
  };
  