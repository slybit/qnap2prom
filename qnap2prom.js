'use strict'

const express = require('express');
const client = require('prom-client');
const register = client.register;
const { createLogger, format, transports } = require('winston');
const { exec } = require("child_process");

const config = {
    prometheus: {
        port: 5000,
        path: 'metrics'
    }
}


// disks
const disks = ["sda", "sdb", "sdc", "sdd"];


// collection of all metrics we will be accumulating


// Initate the logger
const logger = createLogger({
    level: config.loglevel,
    format: format.combine(
      format.colorize(),
      format.splat(),
      format.simple(),
    ),
    transports: [new transports.Console()]
});

// create disk metrics
new client.Gauge({
    name: "disk_standby_status",
    help : "disk standby metrics",
    labelNames: ["id"]
});


const updateMetrics = function() {
    // get disk standby status
    let m = register.getSingleMetric("disk_standby_status");
    for (let disk of disks) {
        exec("hdparm -C /dev/" + disk, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            } else if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            } else {
                if (stdout.includes("standby")) {
                    m.labels(disk).set(0);
                } else {
                    m.labels(disk).set(1);
                }
            }
        }); 
    }
}

updateMetrics();
setInterval(updateMetrics, 60000);





// express server
const server = express();

let path = (config.prometheus && config.prometheus.path) ? '/' + config.prometheus.path : '/metrics';
let port = (config.prometheus && config.prometheus.port) ? config.prometheus.port : 6000;
server.get(path, (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
})

logger.info('Server listening on port %s, metrics exposed on %s', port, path);
server.listen(port);