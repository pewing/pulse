
var express = require('express');
var app = express();
var child_process = require('child_process');
var toString = require('stream-to-string');
var log = require('./log.js');
var dgram = require('dgram');
var util = require('util');

var BROADCAST = "192.168.88.255";
var HEARTBEAT_PORT = 5000;
var CMD_PORT = 5001;

app.get('/', (req, res) => res.send("Hello, World"));

function runCmd(cmd, ...args) {
    return new Promise((accept, reject) => {
        newline();
	    log.info("Running %s, %j", cmd, args)
	    let proc = child_process.execFile(cmd, args);
	    proc.stdout.on('error', e => {
            newline();
	        log.error("IO Error: , %s", e.stack);
	        reject(e);
	    });
	    let out = toString(proc.stdout);
	    proc
	        .on('error', reject)
	        .on('exit', (code, signal) => {
		        if (code === 0) {
                    newline();
		            log.info("Status %s, %j = %d", cmd, args, code)
		            accept(out);
		        } else if (signal) {
		            log.error("Signal %s, %j = %s", cmd, args, signal)
		            reject(new Error(signal));
		        } else {
		            log.error("Signal %s, %j = %d", cmd, args, code)
		            reject(new Error(cmd + " Exited with code " + code));
		        }
	        });
    });
}

function sendErr(res) {
    return err => res.sendStatus(503, err.stack);
}

function sendText(res) {
    return txt => res.end(txt, "UTF-8");
}

function sendJson(res) {
    return json => res.json(json);
}

app.get('/ls/txt', (req, res) => {
    runCmd('/bin/ls', '-l', req.query.dir || ".")
	.then(sendText(res), sendErr(res));
});

// Example:
// http://localhost:8081/ls/json?dir=/Users/hiromi
app.get('/ls/json', (req, res) => {
    runCmd('/bin/ls', '-l', req.query.dir || ".")
	.then(x => ({status: "OK", result: x.split(/\n+/g)}))
	.catch(err => ({status: "ERROR", message: err.message}))
        .then(sendJson(res), sendErr(res));
});

// Our test system state
var PARAMS = {
    source_1: 1,
    bpm_1: 60,
    source_2: 1,
    bpm_2: 60,
    source_3: 1,
    bpm_3: 60
};

// Do a PUT request to:
// http://localhost:8081/val?param=slider1&value=5
// We use PUT to set, GET to get
app.put('/val', (req, res) => {
    // Get the supplied query parameters
    let param = req.query.param
    let value = Number(req.query.value);
    newline();
    log.info("Set %s to %d", param, value);
    PARAMS[param] = value
    res.send({status: "OK", param: param, value: value});
});

// Do a GET request to:
// http://localhost:8081/val?param=slider1
// We use PUT to set, GET to get
app.get('/val', (req, res) => {
    // Get the supplied query parameters
    let param = req.query.param
    let value = PARAMS[param];
    if (value === undefined) {
	return res.send({status: "ERROR", message: "Parameter " + param + " is not set.", param: param});
    }
    newline();
    log.info("Set %s to %d", param, value);
    res.send({status: "OK", param: param, value: value});
});

app.put('/trigger', (req, res) => {
    let event = req.query.name;
    newline();
    log.info("Trigger %s", event);
    // A delay before sending confirmation to allow the UI feedback to be visible.
    setTimeout(() => res.send({status: "OK", name: event}), 1500);
});

app.get('/status', (req, res) => {
    res.send({status: "OK", params: PARAMS, nodes: {node1: "OK", node2: "OK"}});
});

// Send files in the params/ subdirectory. Use ".json" for json files, .txt for text files.
// http://localhost:8081/params/fuel.json
app.use("/params", express.static("params", {}))


var server = app.listen(8081, function () {

    var host = server.address().address
    var port = server.address().port

    log.info("Test app listening at http://%s:%d", host, port);
    log.info("Broadcasting heartbeat to %s:%d", BROADCAST, port);
    log.info("Sending heartbeat to emulator at 127.0.0.1:%d", port);
});

const udp_pulse = dgram.createSocket({type: 'udp4', reuseAddr: true})
      .on('listening', () => udp_pulse.setBroadcast(true));
var seq = 0;
var hpos = 0;
function newline() {
    if (hpos > 0) {
        process.stdout.write("\n");
        hpos = 0;
    }
}

function sendPulse(id) {
    try {
        const c = '-+==!#$@%^&.,/?'[id];
        process.stdout.write(c);
        hpos++;
        const message = Buffer.alloc(16);
        message.fill(0);
        message.writeUInt8(id, 0); // pod_id
        seq = (seq + 1) && 0xff;
        message.writeUInt8(seq, 1);    // rolling_sequence
        message.writeUInt16LE(1000, 2); // beat_interval_ms
        message.writeUInt32LE(0, 4);    // elapsed_ms
        message.writeFloatLE(60.0, 8);  // est_BPM
        message.writeUInt32LE(Date.now() & 0xfffffff, 12); // time
        // Send to localhost port 5000; must set up emulator to forward
        // telnet to emulator, authorize, and enter
        // redir add udp:5000:5000
        udp_pulse.send(message, HEARTBEAT_PORT, "127.0.0.1");
        // And broadcast. Should find netmask and construct the right broadcast address.
        udp_pulse.send(message, HEARTBEAT_PORT, BROADCAST);
    } catch (e) {
        newline();
        console.error("Error: " + e);
    }
}

setInterval(() => sendPulse(0), 1000);
setInterval(() => sendPulse(1), 823);

function decode_cmd(msg) {
    if (msg.length < 8) {
        return msg;
    }
    return util.inspect({
        rcv: msg.readUInt8(0),
        trk: msg.readUInt8(1),
        cmd: msg.readUInt16LE(2),
        data: msg.readUInt32LE(4)
    });
}

const udp_cmd = dgram.createSocket({type: 'udp4', reuseAddr: true});

function show(msg, info) {
    try {
        newline();
        console.log(`UDP port ${info.address}:${info.port} => ${decode_cmd(msg)}`);
    } catch (e) {
        newline();
        console.error("Log failure: " + e.message);
    }
}

udp_cmd
    .on('error', (err) => console.error("Binding Error", err))
    .on('listening', () => console.log(`Listening on UDP interface ${udp_cmd.address().address} port ${udp_cmd.address().port}`))
    .on('message', show)
    .bind({port: CMD_PORT});
