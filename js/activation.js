import * as Protocol from './protocol.js';

let deviceMap = new Map();
let deviceIndex = 0;
let otaPending = false;
let binFile = null;


const messages = {
    'title': 'システム情報',
    'notSupport': 'Google Chrome または Microsoft Edge をご使用ください',
    'notConnect': '端末が接続されていません',
    'activated': 'アクティベーションが完了しました',
    'deactivated': 'アクティベーションが完了していません',
    'alreadyActivated': 'アクティベーションが完了しました',
};

const hidFilters = [
    { 'vendorId': 0x3318 },
];

let pendingAction = 0;

// Formats an 8-bit integer |value| in hexadecimal with leading zeros.
function hex8(value) {
    return ('00' + value.toString(16)).substr(-2).toUpperCase();
};


function time2Bytes(time) {
    let timeBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {

        console.log('', i, (time >> i));
        timeBytes[i] = (time >> i) & 0x000000FF;
    }
    return timeBytes;
};


// FIXME: not correct
function bytes2Time(bytes) {

    let time = 0;
    for (let i = bytes.byteLength - 1; i >= 0; i--) {
        time += bytes[i] << (i * 8);
    }
    return time;
};

function bytes2String(buffer) {
    let bufferString = '';
    for (let byte of buffer)
        bufferString += ' ' + hex8(byte);
    return bufferString;
}

function bin2String(array) {
    let result = "";
    for (let i = 0; i < array.length; i++) {
        result += String.fromCharCode(parseInt(array[i], 2));
    }
    return result;
}

function handleInputReport({ device, reportId, data }) {
    const reportData = new Uint8Array(data.buffer);

    let result = parse_rsp(reportData);

    if (true) {

        console.log('handleInputReport raw', bytes2String(reportData));
        console.log('handleInputReport msg: %d, status: %d, payload: %s',
            hex8(result.msgId),
            result.status,
            bytes2String(result.payload));

    }
    if (result.msgId == MESSAGES.R_ACTIVATION_TIME) {
        const time = bytes2Time(reportData.subarray(23, 31));
        if (time === undefined || time < 1) {
            console.log('to activate');
            activate(device);
        } else {
            showDialog(messages.title, messages.alreadyActivated);
        }

    } else if (result.msgId == MESSAGES.W_ACTIVATION_TIME) {
        // activate success

        let btnSuccess = document.getElementById('ID_Acti_Success');
        if (btnSuccess != null) {
            btnSuccess.click();
            console.log("btnSuccess clicked.");
        }
        showDialog(messages.title, messages.activated);
    } else if (result.msgId == MESSAGES.W_CANCEL_ACTIVATION) {
        showDialog(messages.title, messages.deactivated);
    } else if (result.msgId == MESSAGES.R_MCU_APP_FW_VERSION) {
        const version = String.fromCharCode.apply(null, result.payload);
        console.log('MCU APP FW version: %s', version);
        if (otaPending) {
            sendReport(device, cmd_build(MESSAGES.W_UPDATE_MCU_APP_FW_PREPARE)).then(() => {
                console.log('update MCU app fw prepare');
            });
        }
    } else if (result.msgId == MESSAGES.W_UPDATE_MCU_APP_FW_PREPARE) {

        // jump to boot
        sendReport(device, cmd_build(MESSAGES.W_MCU_APP_JUMP_TO_BOOT)).then(() => {
            console.log('jump to boot');
        });
    } else if (result.msgId == MESSAGES.W_MCU_APP_JUMP_TO_BOOT) {

        waitBootDevice();
    }
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitBootDevice() {

    navigator.hid.requestDevice({ filters: hidFilters });
    // for (let i = 0; i < 20; i++) {

    //     console.log("waitBootDevice: %d", i);
    //     await sleep(1000);
    //     navigator.hid.getDevices().then(devices => {
    //         console.log("waitBootDevice:", devices);
    //     });
    //     navigator.usb.getDevices().then(devices => {
    //         console.log("waitBootDevice usb:", devices);
    //     });
    // }
}

async function connectDevices() {

    // all air devices are connected
    if (deviceMap.size == 3) {
        return true;
    }

    let devices = await navigator.hid.requestDevice({ filters: hidFilters });
    if (devices.length == 0) {
        return false;
    }
    for (let device of devices) {
        addDevice(device);
    }
    return true;
}


async function checkConnection() {

    if (navigator.hid === undefined) {
        showDialog(messages.title, messages.notSupport);
        return -1;
    }

    let premised = await connectDevices();
    if (!premised) {
        showDialog(messages.title, messages.notConnect);
        return -2;
    }
    return 1;

}

function tryToActive() {
    checkConnection().then(result => {
        if (result == 1) {
            for (let [id, device] of deviceMap.entries()) {
                // read activation time        
                sendReport(device, cmd_build(MESSAGES.R_ACTIVATION_TIME));
            }
        }
    });
};

function deactivate() {
    checkConnection().then(result => {
        if (result == 1) {
            for (let [id, device] of deviceMap.entries()) {
                // deactivation        
                sendReport(device, cmd_build(MESSAGES.W_CANCEL_ACTIVATION));
            }
        }
    });
}

function activate(device) {
    let time = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x01]);
    sendReport(device, cmd_build(MESSAGES.W_ACTIVATION_TIME, time));
};

async function sendReport(device, buffer) {
    // try open the device 
    if (!device.opened) {
        await device.open();
    }
    let reportData = new Uint8Array(buffer);

    return device.sendReport(0x00, reportData).then(() => {
        return true;
    }).catch((error) => {
        console.log('sent message failed', error);
        return false;
    });
}

function addDevice(device) {
    for (let d of deviceMap.values()) {
        if (d === device) {
            console.log('device already in connected device list.');
            return;
        }
    }
    // if it not matches the filter return.
    if (hidFilters.includes(device.vendorId)) {
        console.log('device is not Nreal\'s.');
        return;
    }


    if (device.productId == 0x0424) {

        deviceMap.set(deviceIndex, device);
        deviceIndex += 1;
        console.log('device added = ', device.productName, deviceIndex, device);
        device.oninputreport = handleInputReport;
    } else if (device.productId == 0x0423) {
        // boot device
        sendFw(device);

    }


};

function removeDevice(device) {
    for (let id in deviceMap.keys()) {
        if (deviceMap.get(id) === device) {
            deviceMap.delete(id);
            console.log('device removed = ' + device.productName + ' ' + id);
            return;
        }

    }
};

function hidSupported() {
    return !(navigator.hid === undefined);
}

function showDialog(title, message) {
    let divMessage = document.getElementById('ID_messageMask');
    if (divMessage == null) {
        alert(message);
    } else {
        divMessage.style.display = 'block';
        document.getElementById('ID_messageTitle').innerHTML = title;
        document.getElementById('ID_messageText').innerHTML = message;
    }
}

async function upgrade() {
    // select firmware file
    await selectFile();
    if (binFile == null) {
        console.log('no bin file selected.');
        return;
    }
    otaPending = true;

    connectDevices().then(result => {
        if (result == 1) {
            // FIXME: how to find out the correct device

            for (let [id, device] of deviceMap.entries()) {

                sendReport(device, cmd_build(MESSAGES.R_MCU_APP_FW_VERSION)).then(result => {
                    console.log('result', result, device);
                });

            }
        }
    });

}

async function selectFile() {
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

        binFile = await filePaths[0].getFile();
        // add file info to ui
        let binEle = document.getElementById('binfile');
        if (binEle != null) {
            binEle.innerText = 'bin file: ' + binFile.name;
        }
        return binFile;
    }

    return null;
}

function forgetAll() {
    // for (let [id, device] of deviceMap.entries()) {
    //     console('forget device', device);
    //     device.forget();
    // }

}


async function test() {
    connectDevices().then(result => {
        if (result == 1) {
            // FIXME: how to find out the correct device

            for (let [id, device] of deviceMap.entries()) {

                sendReport(device, cmd_build(MESSAGES.R_MCU_APP_FW_VERSION)).then(result => {
                    console.log('result', result, device);
                });

            }
        }
    });

}

async function sendFw(device) {
    if (binFile == null) {
        selectFile();
    }

    if (binFile == null) {
        return;
    }

    let fwData = await binFile.arrayBuffer();

    let data = new Uint8Array(fwData);
    let ofs = 0;

    console.log('send fw app mode start');
    await sendReport(device, cmd_build(MESSAGES.W_UPDATE_MCU_APP_FW_START, data.slice(ofs, ofs + 24)));

    ofs += 24;
    const fw_len = data.length;

    console.log('send fw app mode transmit');
    while (ofs < fw_len) {
        if ((ofs + 42) > fw_len) {
            await sendReport(device, cmd_build(MESSAGES.W_UPDATE_MCU_APP_FW_TRANSMIT, data.slice(ofs, fw_len)));
            ofs += fw_len;
        }
        await sendReport(device, cmd_build(MESSAGES.W_UPDATE_MCU_APP_FW_TRANSMIT, data.slice(ofs, ofs + 42)));
        ofs += 42;
    }

    /* send finish */
    console.log('send fw app mode finish flag');
    await sendReport(device, cmd_build(MESSAGES.W_UPDATE_MCU_APP_FW_FINISH));
    /* jump to app */

    console.log("send fw app mode jump to app");
    await sendReport(device, cmd_build(MESSAGES.W_BOOT_JUMP_TO_APP));
    console.log("send fw app mode finish");

    otaPending = false;
}

window.onload = () => {

    let btnMessage = document.getElementById('ID_messageButton');
    if (btnMessage != null) {
        btnMessage.onclick = () => {
            document.getElementById('ID_messageMask').style.display = 'none';
        }
    }
    if (!hidSupported()) {
        showDialog(messages.title, messages.notSupport);
        return;

    }

    navigator.hid.onconnect = e => {
        // add device to connected device list.
        addDevice(e.device);
    };

    navigator.hid.ondisconnect = e => {
        removeDevice(e.device);

    };


    navigator.hid.getDevices().then(devices => {
        for (let device of devices) {
            addDevice(device);
        }
    });
    // add click events
    let btnConnect = document.getElementById('ID_connect');
    if (btnConnect != null) {
        btnConnect.onclick = () => {
            tryToActive();
        };
    }
}



export { connectDevices, tryToActive, deactivate, test };