
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


export function checkConnection() {
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
    }).then(async devices => {
        for (let device of devices) {
            if (await canCommand(device)) {
                curGlasses = new Glasses(device);
                if (DEBUG) console.log('glasses requests', curGlasses);
                return curGlasses;
            }
        }
    });
}


function isNrealDevice(device) {
    return device.vendorId === Protocol.NREAL_VENDOR_ID;
}

function getGlasses() {
    return curGlasses;
}


export async function connectDevice() {
    let glasses = await checkConnection();
    if (glasses == undefined) {
        glasses = await requestDevice();
    }
    return glasses;
}


async function hasActivated(glasses) {
    let activationReport = await glasses.sendReportTimeout(Protocol.MESSAGES.R_ACTIVATION_TIME);

    if (reportSuccess(activationReport) && activationReport.payload.length > 0) {
        let time = Protocol.bytes2Time(activationReport.payload);
        return time > 0;
    }
    return false;
}

/** activate the glasses */
export async function activate() {

    let glasses = await connectDevice();
    if (!glasses) {
        return false;
    }
    if (await hasActivated(glasses)) {
        return true;
    }

    // hardcode value = 300
    const time = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x01]);
    return glasses.sendReportTimeout(Protocol.MESSAGES.W_ACTIVATION_TIME, time)
        .then(report => {
            return reportSuccess;
        });
}

/** deactivate the glasses */
export async function deactivate() {
    let glasses = await connectDevice();
    if (!glasses) {
        return false;
    }
    return glasses.sendReportTimeout(Protocol.MESSAGES.W_CANCEL_ACTIVATION)
        .then(report => {
            return reportSuccess;
        });
}

/** read firmware version*/
export async function getFirmwareVersion() {
    let glasses = await connectDevice();
    if (!glasses) {
        return 'not found device';
    }
    return glasses.sendReportTimeout(Protocol.MESSAGES.R_MCU_APP_FW_VERSION)
        .then(report => {
            if (reportSuccess) {
                return String.fromCharCode.apply(null, report.payload);
            }
        });
}



export async function selectBinFile() {
    const pickerOpts = {
        types: [
            {
                description: 'firmware image',
                accept: {
                    'bin/*': ['.bin']
                }
            },
        ],
        excludeAcceptAllOption: true,
        multiple: false
    };

    let filePaths = await window.showOpenFilePicker(pickerOpts);
    if (filePaths.length > 0) {
        return filePaths[0].getFile();
    }
    return null;
}


function isBootDevice(device) {
    return device.vendorId === Protocol.NREAL_VENDOR_ID
        && device.productId === Protocol.BOOT_PRODUCT_ID;
}

async function waitBootDevice() {
    let devices = await navigator.hid.getDevices().then(devices => {
        return devices.filter(isBootDevice);
    });

    if (devices.length > 0) {
        return devices[0];
    }
    navigator.hid.requestDevice({
        filters: [{ vendorId: Protocol.NREAL_VENDOR_ID, productId: Protocol.NREAL_BOOT_PRODUCT_ID }]
    });
    const time = new Date().getTime();
    while ((new Date().getTime() - time) < 2000) {
        await new Promise(resolve => setTimeout(resolve, 20));
        devices = await navigator.hid.getDevices().then(devices => {
            return devices.filter(isBootDevice);
        });
        if (devices.length > 0) {
            return devices[0];
        }
    }
}


export async function upgrade(data) {
    let glasses = await connectDevice();
    if (!glasses) {
        return false;
    }
    console.log('upgrade start data:', data.byteLength);
    return glasses.sendReportTimeout(Protocol.MESSAGES.W_UPDATE_MCU_APP_FW_PREPARE)
        .then(report => {
            if (reportSuccess) {
                return glasses.sendReportTimeout(Protocol.MESSAGES.W_MCU_APP_JUMP_TO_BOOT);
            }
        }).then(async (report) => {
            if (reportSuccess) {
                let device = await waitBootDevice();
                if (device) {
                    console.log('upgrade start data:', data.byteLength);
                    return sendFirmware(new Glasses(device), data);
                }
            }

        });
}


async function sendFirmware(bootDevice, data) {

    console.log('send firmware to ', bootDevice.device);
    let ofs = 0;
    const firstPackLen = 24;
    const fwLen = data.byteLength;

    if (DEBUG) console.log('send fw app mode start');



    let report = await bootDevice.sendReportTimeout(
        Protocol.MESSAGES.W_UPDATE_MCU_APP_FW_START,
        data.slice(ofs, ofs + firstPackLen));
    if (!reportSuccess(report)) {
        console.error('send fw data failed');
        return false;
    }
    ofs += firstPackLen;

    // if (DEBUG) console.log('upgrade percent ', ofs / fwLen * 100);
    if (DEBUG) console.log('fw len', fwLen);

    if (DEBUG) console.log('send fw app mode transmit');
    while (ofs < fwLen) {
        if ((ofs + 42) > fwLen) {
            report = await bootDevice.sendReportTimeout(
                Protocol.MESSAGES.W_UPDATE_MCU_APP_FW_TRANSMIT,
                data.slice(ofs, fwLen));
            if (!reportSuccess(report)) {
                console.error('send fw data failed');
                return false;
            }
        }
        report = await bootDevice.sendReportTimeout(
            Protocol.MESSAGES.W_UPDATE_MCU_APP_FW_TRANSMIT,
            data.slice(ofs, ofs + 42));

        if (!reportSuccess(report)) {
            console.error('send fw data failed');
            return false;
        }
        ofs += 42;
        // if (DEBUG) console.log('upgrade percent ', ofs / fwLen * 100);
    }

    /* send finish */
    if (DEBUG) console.log('send fw app mode finish flag');
    report = await bootDevice.sendReportTimeout(Protocol.MESSAGES.W_UPDATE_MCU_APP_FW_FINISH);
    // if (!reportSuccess(report)) {
    //     console.error('send fw data failed');
    //     return false;
    // }
    /* jump to app */
    if (DEBUG) console.log("send fw app mode jump to app");
    report = await bootDevice.sendReportTimeout(Protocol.MESSAGES.W_BOOT_JUMP_TO_APP);
    // if (!reportSuccess(report)) {
    //     console.error('send fw data failed');
    //     return false;
    // }
    if (DEBUG) console.log("send fw app mode finish");
    return true;


}


function reportSuccess(report) {
    return report && report.status === 0;
}

