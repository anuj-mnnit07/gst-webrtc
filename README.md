1. Steps to Run Server:
   1. Install python websockets
   ```
    python3 -m pip install websockets
   ```
   2.  Change to server directory
   ```bash
   cd server
   ```
   3. generate certificates for TLS
   ```bash
   bash generate_certs.sh
   ``` 
   4. Open Terminal Instance-1 and Run websocket server
   ```bash
   python3 simple_server.py
   ```
   5. Open Terminal Instance-2 and Run Websocket client
   ```bash
   python3 room_client.py --room 123
   ```
   By default, above will run the server at https://127.0.0.1:8443 . Open this in browser and accept the certificate for TLS connection if certificates are generated from the generate_certs.sh script.
   6. Open server/js/index.html in firefox browser and it will by default connect to websocket server at https://127.0.0.1:8443 and if successful it will show peer-id in browser. Note the peer-id for running client

2. Running the client
   1. Install gstreamer component with gtk+3, libsoup and glib
   2. Move to root of the repository and build the source
   ```bash
   make
   ```
   It will generate webrtc executable.
   3. Get the peer-id from url https://127.0.0.1:8443 and run the client with below command
   ```bash
   ./webrtc --peer-id <PEER_ID>
   ```
   4. Currently it runs with videotestsrc and audiotestsrc. Modify videotestsrc with v4l2src or other source based on camera source. Grant the audio/video permission to the browser.