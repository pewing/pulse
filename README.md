# Pulse

https://www.kickstarter.com/projects/flg/pulse-flaming-lotus-girls-2016-burning-man-art/description

## Contributing

Use this branching model http://nvie.com/posts/a-successful-git-branching-model/

**Adding a feature**

1. Ensure you're up to date
```
git checkout develop
git pull origin develop
```
2. Branch off devleop
```
git checkout -b feature/your-thing develop
# hack, hack
git push origin feature/your-thing
```
3. Open PR with `develop` as base and `feature/your-thing` as compare
https://github.com/FlamingLotusGirls/pulse/pulls

**Fixing a bug**

*Same as above, but prefix branch name with* `bugfix/` as in `bugfix/thing-i-fixed`

## Project Structure
* lights - code to control LED / fadecandy, listens for commands
* BPM - Code to detect heartbeats and put the pulses out on the network<br>
* avr - Code that runs on the 8-output relay driver boards (see eagle files in flg-svn)<br>
* avr-proportional - code that runs on the proportional valve driver board (no eagle files ... yet)<br>
* test-proportional - Android code for running the proportional valve driver board. Can run on any android device, requires standard FTDI USB to 485 cable to connect with board<br>
* testApp - Android and PC code for running the 8-output relay driver board. Can run on any android device, or web interface + python can run on Mac/Linux box. Requires standard FTDI USB to 485 cable to connect with board
* audio - Sketches for ALSA audio drivers, incomplete<br>
* network - multicast listener for heartbeats, controls relay board to send heartbeat and other patterns. Python, runs on RPi and Mac (intended for RPi in the sculpture)<br>
* dmx - Code for operating the Elation Professional Sixpar 200IP spotlights via a DMX controller

## Todo
* LEDs. Lighting for pulse pods<br>
* Mobile Interactive. Code for whatever games on mobile interactive unit<br>
* Geek console. UI, controls for the geeks back at the geek table.<br>

* Pod_daemon    A daemon run at startup that coordinates the heartbeat sensor (BPM), POD LED's, and audio
* MIU_daemon    A daemon run at startup that communicates with two heartbeat sensors (BPM), triggers LED fx, and sends out UDP packets
* Heart_daemon  A daemon run at startup that listens to udp packets from two PODs and the MIU sensors

## General architecture

The system is a distributed network where information is sent over broadcast UDP packets. There are two types of 
data - commands and heartbeat signals. The different types of data are sent over different ports - 5000 for heartbeats, and 5001 for commands.

There are currently six distinct entities in the system, each with its own ID Each entity has an ID:

  0 - auto generated heartbeat
	1 - pod 1 (generates heartbeat, handles pod LED and audio commands)
	2 - pod 2 (generates heartbeat, handles pod LED and audio commands)
	3 - heart controls (does not generate heartbeats, handles flame and DMX commands)
	4 - MIU left  (generates heartbeat)
	5 - MIU right (generates heartbeat)

Heartbeat data contains the time at which the heartbeat happened (offset from current time), the heartbeat frequency,
and the ID of the heartbeat source, ie:

	struct __BPMPulseData_t {
    		uint8_t  pod_id; // which pod. pass as param in startup file.
    		uint8_t  rolling_sequence;
    		// just repeat every 256 iterations. for tracking gaps in
    		// UDP packets in case we have some situation where it happens.
    		uint16_t beat_interval_ms;
    		// min BPM 30 has ms interval of 2000
    		// max BPM 200 has ms interval of 300
    		uint32_t elapsed_ms; // how long before now did this happen?
		uint32_t timestamp;  // timestamp, normalized to the pod that sent this. Do not assume that the pods are in sync.
		float est_BPM; // computed as 60*1000/beat_interval_ms by sender.
	}__attribute__((packed)); 
 

Command data contains the id of the entity the command is meant for, a command code, and a 32-bit data field that depends on 
the particular commands, ie:

	typedef struct __attribute((packed)) {
    		uint8_t  receiver_id;         // which unit is this command for. 255 means 'this is for everyone'
    		uint8_t  command_tracking_id; // id specific to this command, can be used for ACK/NACK if we build that 
    		uint16_t command_id;          // command for the unit; do not respond to commands that you don't understand
    		uint32_t command_data;        // may or may not have anything in it, depending on the command
	} PulseCommand_t;

Current commands include:

    STOP_ALL             = 1
    STOP_HEARTBEAT       = 2
    START_HEARTBEAT      = 3
    START_EFFECT         = 4
    STOP_EFFECT          = 5
    USE_HEARTBEAT_SOURCE = 6
    DMX_STROBE           = 7
    DMX_SINGLE_COLOR     = 8
    AORTA_CHASE          = 9
    AORTA_ATTACK         = 10
    PLAY_SOUND           = 11
    AORTA_1              = 12
    AORTA_2              = 13
    AORTA_3              = 14

Note that entity id 0xFF means 'all receiving entities', so, for instance, [0xff,0,6,0] means 'all entities use the autogenerated 
heartbeat as their source'

## Pod Lighting

### Setup

```
cd pods
./setup.sh # installs dependencies to ./vendor, runs make
```
### Run

```
bin/pod.py
```

### Test

*`cd ...` assumes you're at the project top level*

```
cd network
python heartbeat_server.py

cd pods/vendor/openpixelcontrol
bin/gl_server ../../models/pulse_pod.json 7890 ../../models/pulse_pod-binary.stl --initcam='0.00 -49.00 0.00 89.0 302.4 1 1080.00'
# in GL window, press 'm' for mesh wireframe of .stl
# press 'j' to toggle between initial json file lighting (good for debug) and using opc signals

cd {proj_root}
bin/pod.py
```
