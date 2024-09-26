// Set this to override the automatic detection in websocketServerConnect()
var ws_server; // WebSocket server address
var ws_port;   // WebSocket server port
// Set this to use a specific peer id instead of generating a random one
var default_peer_id;
// Override with your own STUN servers if needed
var rtc_configuration = {
  iceServers: [
    { urls: "stun:stun.services.mozilla.com" },  // STUN server for NAT traversal
    { urls: "stun:stun.l.google.com:19302" }     // Another STUN server
  ]
};
// Default media constraints (both audio and video enabled)
var default_constraints = { video: true, audio: true };

var connect_attempts = 0;  // Number of attempts to connect to the server
var peer_connection;       // RTCPeerConnection object for WebRTC communication
var send_channel;          // Data channel for sending/receiving data
var ws_conn;               // WebSocket connection object
var local_stream_promise;  // Promise for accessing local media (camera, mic)

// Function to set the state of the 'Connect' button
function setConnectButtonState(value) {
    var button = document.getElementById("peer-connect-button");
    if (button) button.value = value;
}

// Returns true if the user wants the remote peer to initiate the offer
function wantRemoteOfferer() {
    var checkbox = document.getElementById("remote-offerer");
    return checkbox && checkbox.checked;
}

// Event handler for when the 'Connect' button is clicked
function onConnectClicked() {
    var button = document.getElementById("peer-connect-button");
    if (button.value == "Disconnect") {
        resetState();  // If already connected, reset the connection
        return;
    }

    var id = document.getElementById("peer-connect").value;
    if (id == "") {
        console.error("Peer id must be filled out");
        return;  // Require a peer ID to initiate connection
    }

    ws_conn.send("SESSION " + id);  // Send session initiation to the signaling server
    setConnectButtonState("Disconnect");  // Change button text to 'Disconnect'
}

// Generate a random ID for the local peer
function getOurId() {
    return Math.floor(Math.random() * (9000 - 10) + 10).toString();
}

// Function to reset the state by closing the WebSocket connection
function resetState() {
    ws_conn.close();  // This triggers the `onServerClose` function
}

// Handle incoming error messages from the server
function handleIncomingError(error) {
    console.error("ERROR: " + error);
    resetState();  // Reset the state on error
}

// Get the video element where the stream will be displayed
function getVideoElement() {
    return document.getElementById("stream");
}

// Set the status message in the console (for debugging)
function setStatus(text) {
    console.log(text);
}

// Log an error message in the console
function setError(text) {
    console.error(text);
}

// Reset the video element and stop local media streams
function resetVideo() {
    // Stop all tracks (video/audio)
    if (local_stream_promise)
        local_stream_promise.then(stream => {
            if (stream) {
                stream.getTracks().forEach(function (track) { track.stop(); });
            }
        });

    // Reset the video element (clear the last frame)
    var videoElement = getVideoElement();
    videoElement.pause();
    videoElement.src = "";
    videoElement.load();  // Reload the element to apply changes
}

// Handle incoming SDP (Session Description Protocol) messages
function onIncomingSDP(sdp) {
    peer_connection.setRemoteDescription(sdp).then(() => {
        setStatus("Remote SDP set");  // Confirm remote SDP was set successfully
        if (sdp.type != "offer") return;  // Only respond if it's an SDP offer

        setStatus("Got SDP offer");
        local_stream_promise.then((stream) => {
            setStatus("Got local stream, creating answer");
            peer_connection.createAnswer()  // Create an SDP answer
            .then(onLocalDescription)  // Handle the local SDP description
            .catch(setError);
        }).catch(setError);
    }).catch(setError);
}

// Handle the local SDP description (generated offer/answer)
function onLocalDescription(desc) {
    console.log("Got local description: " + JSON.stringify(desc));
    peer_connection.setLocalDescription(desc).then(function() {
        setStatus("Sending SDP " + desc.type);
        sdp = { 'sdp': peer_connection.localDescription };  // Prepare the SDP to send
        ws_conn.send(JSON.stringify(sdp));  // Send the SDP through the WebSocket
    });
}

// Generate an SDP offer (for initiating a WebRTC connection)
function generateOffer() {
    peer_connection.createOffer()  // Create the offer
    .then(onLocalDescription)  // Handle the SDP offer
    .catch(setError);  // Handle any errors during the offer creation
}

// Handle incoming ICE (Interactive Connectivity Establishment) candidates
function onIncomingICE(ice) {
    var candidate = new RTCIceCandidate(ice);  // Create a new ICE candidate
    peer_connection.addIceCandidate(candidate).catch(setError);  // Add ICE candidate to peer connection
}

// Handle messages received from the signaling server
function onServerMessage(event) {
    console.log("Received " + event.data);
    switch (event.data) {
        case "HELLO":  // Server confirms registration
            setStatus("Registered with server, waiting for call");
            return;
        case "SESSION_OK":  // Session successfully initiated
            setStatus("Starting negotiation");
            if (wantRemoteOfferer()) {  // Check if the remote peer should send an offer
                ws_conn.send("OFFER_REQUEST");  // Request an offer from the remote peer
                setStatus("Sent OFFER_REQUEST, waiting for offer");
                return;
            }
            if (!peer_connection)
                createCall(null).then(generateOffer);  // Generate an offer if this peer initiates
            return;
        case "OFFER_REQUEST":  // Remote peer requested an offer from us
            if (!peer_connection)
                createCall(null).then(generateOffer);  // Generate the offer
            return;
        default:
            if (event.data.startsWith("ERROR")) {
                handleIncomingError(event.data);  // Handle errors from the server
                return;
            }

            // Parse incoming SDP/ICE JSON messages
            try {
                msg = JSON.parse(event.data);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    handleIncomingError("Error parsing incoming JSON: " + event.data);
                } else {
                    handleIncomingError("Unknown error parsing response: " + event.data);
                }
                return;
            }

            // Initialize the peer connection if not already done
            if (!peer_connection)
                createCall(msg);

            // Handle incoming SDP and ICE messages
            if (msg.sdp != null) {
                onIncomingSDP(msg.sdp);  // Handle incoming SDP
            } else if (msg.ice != null) {
                onIncomingICE(msg.ice);  // Handle incoming ICE candidate
            } else {
                handleIncomingError("Unknown incoming JSON: " + msg);  // Handle unknown JSON
            }
    }
}

// Called when the WebSocket connection is closed
function onServerClose(event) {
    setStatus('Disconnected from server');
    resetVideo();  // Reset the video stream

    if (peer_connection) {
        peer_connection.close();  // Close the WebRTC connection
        peer_connection = null;  // Reset the connection object
    }

    // Attempt reconnection after 1 second
    window.setTimeout(websocketServerConnect, 1000);
}

// Called when there is an error with the WebSocket connection
function onServerError(event) {
    setError("Unable to connect to server, did you add an exception for the certificate?");
    // Retry connection after 3 seconds
    window.setTimeout(websocketServerConnect, 3000);
}

// Get the local video/audio stream based on constraints
function getLocalStream() {
    var constraints;
    var textarea = document.getElementById('constraints');
    try {
        constraints = JSON.parse(textarea.value);  // Parse the media constraints from the user
    } catch (e) {
        console.error(e);
        setError('ERROR parsing constraints: ' + e.message + ', using default constraints');
        constraints = default_constraints;  // Use default constraints on error
    }
    console.log(JSON.stringify(constraints));

    // Request access to the user's media devices (camera, mic)
    if (navigator.mediaDevices.getUserMedia) {
        return navigator.mediaDevices.getUserMedia(constraints);
    } else {
        errorUserMediaHandler();  // Error if `getUserMedia` is not supported
    }
}

// Establish connection with the WebSocket signaling server
function websocketServerConnect() {
    connect_attempts++;  // Increment connection attempts
    if (connect_attempts > 3) {
        setError("Too many connection attempts, aborting. Refresh page to try again");
        return;  // Stop trying after 3 attempts
    }

    // Clear any previous error messages
    var span = document.getElementById("status");
    if (span) {
        span.classList.remove('error');
        span.textContent = '';
    }

    // Populate media constraints in the UI
    var textarea = document.getElementById('constraints');
    if (textarea && textarea.value == '')
        textarea.value = JSON.stringify(default_constraints);

    // Generate or retrieve the peer ID
    peer_id = default_peer_id || getOurId();
    document.getElementById("peer-id").textContent = peer_id;

    // Determine the WebSocket server address and port
    ws_port = ws_port || '8443';
    if (window.location.protocol.startsWith("file")) {
        ws_server = ws_server || "127.0.0.1";
    } else if (window.location.protocol.startsWith("http")) {
        ws_server = ws_server || window.location.hostname;
    } else {
        throw new Error("Don't know how to connect to the signaling server with uri" + window.location);
    }

    // WebSocket URL
    var ws_url = 'ws://' + ws_server + ':' + ws_port;
    setStatus("Connecting to server " + ws_url);
    ws_conn = new WebSocket(ws_url);  // Establish WebSocket connection

    // When the WebSocket opens, send HELLO message
    ws_conn.addEventListener('open', (event) => {
        document.getElementById("peer-id").textContent = peer_id;
        ws_conn.send('HELLO ' + peer_id);  // Register peer with the server
        setStatus("Registering with server");
        setConnectButtonState("Connect");  // Change button state to 'Connect'
    });

    // Set event handlers for WebSocket
    ws_conn.addEventListener('error', onServerError);
    ws_conn.addEventListener('message', onServerMessage);
    ws_conn.addEventListener('close', onServerClose);
}

// Handle remote media stream tracks
function onRemoteTrack(event) {
    var remoteVideoElement = document.getElementById("remoteCameraFeed");
    if (remoteVideoElement.srcObject !== event.streams[0]) {
        console.log('Incoming stream');
        remoteVideoElement.srcObject = event.streams[0];  // Set the source of the remote stream
    }
}

// Error handler for unsupported `getUserMedia`
function errorUserMediaHandler() {
    setError("Browser doesn't support getUserMedia!");  // Log error if `getUserMedia` is unsupported
}

// Handle DataChannel open event
const handleDataChannelOpen = (event) => {
    console.log("dataChannel.OnOpen", event);
};

// Handle DataChannel message event (when a message is received)
const handleDataChannelMessageReceived = (event) => {
    console.log("dataChannel.OnMessage:", event, event.data.type);
    setStatus("Received data channel message");

    // If the message is a string, append it to the text area
    if (typeof event.data === 'string' || event.data instanceof String) {
        console.log('Incoming string message: ' + event.data);
        textarea = document.getElementById("text");
        textarea.value = textarea.value + '\n' + event.data;
    } else {
        console.log('Incoming data message');
    }
    send_channel.send("Hi! (from browser)");  // Send a message back through the DataChannel
};

// Handle DataChannel error event
const handleDataChannelError = (error) => {
    console.log("dataChannel.OnError:", error);
};

// Handle DataChannel close event
const handleDataChannelClose = (event) => {
    console.log("dataChannel.OnClose", event);
};

// Handle the creation of a DataChannel
function onDataChannel(event) {
    setStatus("Data channel created");
    let receiveChannel = event.channel;  // Get the created DataChannel
    receiveChannel.onopen = handleDataChannelOpen;
    receiveChannel.onmessage = handleDataChannelMessageReceived;
    receiveChannel.onerror = handleDataChannelError;
    receiveChannel.onclose = handleDataChannelClose;
}

// Create the RTCPeerConnection and set up DataChannel and media streams
function createCall(msg) {
    connect_attempts = 0;  // Reset connection attempts

    console.log('Creating RTCPeerConnection');
    peer_connection = new RTCPeerConnection(rtc_configuration);  // Create the peer connection

    // Create a DataChannel
    send_channel = peer_connection.createDataChannel('label', null);
    send_channel.onopen = handleDataChannelOpen;
    send_channel.onmessage = handleDataChannelMessageReceived;
    send_channel.onerror = handleDataChannelError;
    send_channel.onclose = handleDataChannelClose;

    // Set up event handlers for incoming media and data
    peer_connection.ondatachannel = onDataChannel;
    peer_connection.ontrack = onRemoteTrack;

    // Get and add the local stream (camera/mic)
    local_stream_promise = getLocalStream().then((stream) => {
        console.log('Adding local stream');
        peer_connection.addStream(stream);  // Add the local stream to the peer connection
        return stream;
    }).catch(setError);

    if (msg != null && !msg.sdp) {
        console.log("WARNING: First message wasn't an SDP message!?");
    }

    // Handle ICE candidates (needed for connection establishment)
    peer_connection.onicecandidate = (event) => {
        if (event.candidate == null) {
            console.log("ICE Candidate was null, done");
            return;
        }
        ws_conn.send(JSON.stringify({ 'ice': event.candidate }));  // Send the ICE candidate to the server
    };

    if (msg != null)
        setStatus("Created peer connection for call, waiting for SDP");

    return local_stream_promise;  // Return the local stream promise
}

// Initialize the WebRTC connection when the page loads
window.onload = function() {
    websocketServerConnect();  // Connect to the WebSocket server
    document.getElementById("peer-connect-button").addEventListener("click", onConnectClicked);  // Set the 'Connect' button event handler
};
