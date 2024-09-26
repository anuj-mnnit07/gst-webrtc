let preview = document.getElementById("stream");
let recording = document.getElementById("stream");
let startRecordingButton = document.getElementById("startRecording");
let stopRecordingButton = document.getElementById("stopRecording");
let downloadRecordingButton = document.getElementById("downloadRecording");
// let logElement = document.getElementById("log");
let recorder;

function log(msg) {
  //log messages on screen
  console.log(msg);
  // logElement.innerHTML = msg + "\n";
}

function startRecording(stream) {
  //start recording
  recorder = new MediaRecorder(stream); //api to record media in javascript provides different functionalities
  // as media pause, resume, start, stop, requestData - request blob of recorded media
  let data = [];
  recorder.ondataavailable = (event) => data.push(event.data);
  recorder.start(); //strt the recording

  log('"Recording..."');

  //when stopped it will resolve the promise
  let stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (event) => reject(event.name);
  });

  //when stopped it will return the data when it is recorded and stopped completely
  return Promise.all([stopped, recorder]).then(() => data);
}

function stop(stream) {
  if (recorder.state == "recording") {
    recorder.stop();
  }

  //getTracks = returns a sequence that represents all the MediaStreamTrack objects and stops
  //all them
  stream.getTracks().forEach((track) => track.stop());
}

startRecordingButton.addEventListener(
  "click",
  function () {
    navigator.mediaDevices
      .getDisplayMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        // //stream - MediaStreamTrack
        preview.srcObject = stream;
        // downloadRecordingButton.href = stream;
        preview.captureStream =
          preview.captureStream || preview.mozCaptureStream;
        return new Promise((resolve) => (preview.onplaying = resolve));
      })
      .then(() => startRecording(preview.captureStream()))
      //captureStream() will return a MediaStream object
      //which is streaming a real-time capture of the
      // content being rendered in the media element.
      .then((recordedChunks) => {
        let recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
        recording.src = URL.createObjectURL(recordedBlob);
        downloadRecordingButton.href = recording.src;
        downloadRecordingButton.download = "RecordedVideo.webm";

        log(
          "Successfully recorded " +
            recordedBlob.size +
            " bytes of " +
            recordedBlob.type +
            " media."
        );
      })
      .catch(log);
  },
  false
);

stopRecordingButton.addEventListener(
  "click",
  function () {
    //passing the recorded chunks as argument
    stop(preview.srcObject);
  },
  false
);