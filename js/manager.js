
import Glasses from '/js/glasses.js';
import * as Protocol from './protocol.js';

// let devices = [];
const DEBUG = true;
let curGlasses = null;

/** check browser whether hid support */
export function hidSupported() {
    return !(navigator.hid === undefined);
}
export function addHidListener() {
    navigator.hid.onconnect = function (event) {
        let device = event.device;
        if (isNrealDevice(device)) {
            canCommand(device).then(result => {
                if (result) {
                    curGlasses = new Glasses(device);
                    if (DEBUG) console.log('glasses connected', curGlasses);
                }
            });
        }
    }

    navigator.hid.ondisconnect = function (event) {

        if (curGlasses && curGlasses.device == event.device) {
            if (DEBUG) console.log('glasses disconnected', curGlasses);
            curGlasses = null;
        }
    }

}



function canCommand(device) {
    if (device) {
        let glasses = new Glasses(device);
        return glasses.connect().then(() => {
            return glasses.isMcu();
        });
    }
    return false;
}


function checkConnection() {
    if (curGlasses) {
        return curGlasses;
    }

    return navigator.hid.getDevices().then(devices => {
        // filters out devices that are nreal devices.
        return devices.filter(isNrealDevice);
    }).then(async devices => {
        for (let device of devices) {
            if (await canCommand(device)) {
                curGlasses = new Glasses(device);
                if (DEBUG) console.log('glasses found', curGlasses);
                return curGlasses;
            }
        }
    });
}

function requestDevice() {
    return navigator.hid.requestDevice({
        filters: [{ vendorId: Protocol.NREAL_VENDOR_ID }]
    }).then(async device => {
        if (await canCommand(device)) {
            curGlasses = new Glasses(device);
            if (DEBUG) console.log('glasses requests', curGlasses);
            return curGlasses;
        }
    });
}


function isNrealDevice(device) {
    return device.vendorId === Protocol.NREAL_VENDOR_ID;
}

function getGlasses() {
    return curGlasses;
}



