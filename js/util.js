
import Glasses from '/js/glasses.js';

// let devices = [];
const DEBUG = true;
let glasses = null;

/** check browser whether hid support */
function hidSupported() {
    return !(navigator.hid === undefined);
}
function addHidListener() {
    navigator.hid.onconnect = function (event) {
        let device = event.device;
        canCommand(device).then(result => {
            if (result) {
                glasses = new Glasses(device);
                if (DEBUG) console.log('glasses connected', glasses);
            }
        });
    }

    navigator.hid.ondisconnect = function (event) {

        if (glasses && glasses.device == event.device) {
            if (DEBUG) console.log('glasses disconnected', glasses);
            glasses = null;
        }

        // console.log('disconnect', event.device);
        // let device = event.device;
        // console.log('remove before', devices.length);
        // let index = devices.indexOf(device);
        // console.log('index', index);
        // if (index > -1) {

        //     devices.splice(index, 1);
        //     console.log('remove after', devices.length);
        // }

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
    return navigator.hid.getDevices().then(devices => {
        // filters out devices that are nreal devices.
        return devices.filter(device => device.vendorId === 0x3318);
    }).then(async devices => {
        for (let device of devices) {
            if (await canCommand(device)) {
                glasses = new Glasses(device);
                if (DEBUG) console.log('glasses found', glasses);
                return glasses;
            }
        }
    });
}

function getGlasses() {
    return glasses;
}

export { hidSupported, addHidListener, checkConnection, getGlasses };