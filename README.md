## 1. Windows Setup
   1. Download GitBash from https://git-scm.com/download/win and install it.
   2. Download gstreamer from https://gstreamer.freedesktop.org/download/#windows
      [1.24.8 runtime installer](https://gstreamer.freedesktop.org/data/pkg/windows/1.24.8/mingw/gstreamer-1.0-mingw-x86_64-1.24.8.msi)

      [1.24.8 development installer](https://gstreamer.freedesktop.org/data/pkg/windows/1.24.8/mingw/gstreamer-1.0-devel-mingw-x86_64-1.24.8.msi)
   3. Add gstreamer to system path like **C:\gstreamer\1.0\mingw_x86_64\bin

   4. Download Msys2 from https://github.com/msys2/msys2-installer/releases/download/2024-07-27/msys2-x86_64-20240727.exe and install it.
   5. Open msys2 terminal and install tools using command: 
   	pacman -S make python3 python3-pip pkg-config glib2 gcc
   
   6. Install pip websockets using below:
      ```bash
      # For python version < 3.12
      python3 -m pip websockets
      # For python3.12 it may require virtualenv setup like this:
      python3 -m venv env
      source env/bin/activate
      python3 -m pip install websockets
      ```
   7. For windows, all Terminal Instances are msys2 terminal
## 2. Steps to Run Server:

   1. Install python websockets
   ```bash
   python3 -m pip install websockets
   # Change to server directory
   cd server
   # generate certificates for TLS
   bash generate_certs.sh
   ```

   4. Open Terminal Instance-1 and Run websocket server
   ```bash
   # For python3.12, source ./env/bin/activate should be done as mentioned in step 1.6
   python3 simple_server.py --disable-ssl
   ```
   5. Open Terminal Instance-2 and Run Websocket client
   ```bash
   # For python3.12, source ./env/bin/activate should be done as mentioned in step 1.6
   python3 room_client.py --url ws://localhost:8443 --room 123
   ```
   By default, above will run the server at http://127.0.0.1:8443 . Open this in browser and accept the certificate for TLS connection if certificates are generated from the generate_certs.sh script.
   6. Open server/js/index.html in firefox browser and it will by default connect to websocket server at http://127.0.0.1:8443 and if successful it will show peer-id in browser. Note the peer-id for running client

## 3. Running the client
   1. Open msys2 terminal and add below variable to ~/.bashrc and save it (Only for windows):
   ```bash
   export PKG_CONFIG_PATH=/c/gstreamer/1.0/mingw_x86_64/lib/pkgconfig
   ```
   2. Save the file and run below command (Only for windows):
   ```bash
   source ~/.bashrc
   ```
   3. Move to root of the repository and build the source
   ```bash
   make
   ```
   It will generate webrtc executable.
   4. Get the peer-id from server/js/index.html launched in step 2.6 above and run the client with below command
   ```bash
   # This command must be run from command prompt (not from msys2 terminal)
   ./webrtc --peer-id <PEER_ID>
   # on the browser it asks for allowing permission, wait for 3-5 seconds on windows before giving it to permission. Once Mic/Camera permission given, it will start playing camera feed.
   ```
   5. Currently it runs with ksvideosrc and audiotestsrc. Modify videotestsrc with v4l2src (for linux) and ksvideosrc (for windows) or other source based on camera source. Grant the audio/video permission to the browser. 