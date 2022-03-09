let deviceMap = new Map();
let device = null;
let deviceIndex = 0;


// hid message id bit: 15
// activation bit: 22-30


const MSG_W_ACTIVATION = [
    0xFD, 0xD8, 0x1C, 0x15, 0x05, 0x19, 0x00, 0x62,
    0x80, 0xE0, 0xB6, 0xB3, 0x1E, 0x00, 0x00, 0x2A,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

const MSG_R_ACTIVATION = [
    0xFD, 0xCC, 0xDF, 0x3D, 0x03, 0x11, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

const MSG_W_DEACTIVATION = [
    0xFD, 0x9E, 0x7A, 0x5E, 0xAB, 0x11, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x19,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

const messages = {
    'title': 'System Info',
    'notSupport': 'Please visit through chrome or edge browser',
    'notConnect': 'No glasses connected',
    'activated': 'Activate successfully',
    'deactivated': 'Deactivate successfully',
    'alreadyActivated': 'Already activated',
};

const hidFilters = [
    { 'vendorId': 0x3318 },
];

let pendingAction = 0;

// Formats an 8-bit integer |value| in hexadecimal with leading zeros.
const hex8 = value => {
    return ('00' + value.toString(16)).substr(-2).toUpperCase();
};


const time2Bytes = time => {
    console.log(time);

    let timeBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        timeBytes[i] = (time >> i) & 0xFF;
    }
    return timeBytes;
};

const bytes2Time = bytes => {

    let time = 0;
    for (let i = bytes.byteLength - 1; i >= 0; i--) {
        time += bytes[i] << (i * 8);
    }
    return time;
};

const bytes2String = buffer => {
    let bufferString = '';
    for (let byte of buffer)
        bufferString += ' ' + hex8(byte);
    return bufferString;
}



const handleInputReport = ({ device, reportId, data }) => {
    console.log('handleInputReport', data);
    const reportData = new Uint8Array(data.buffer);

    let msgId = reportData[15];
    console.log('reportData.buffer[15]', msgId);
    if (msgId == 0x29) {
        const time = bytes2Time(reportData.subarray(23, 31));
        if (time === undefined || time < 1) {
            console.log('to activate');
            activate(device);
        } else {
            showDialog(messages.title, messages.alreadyActivated);
        }

    } else if (msgId == 0x2A) {
        showDialog(messages.title, messages.activated);
    } else if (msgId == 0x19) {
        showDialog(messages.title, messages.deactivated);
    }
};
const connectDevices = async () => {
    let devices = await navigator.hid.requestDevice({ filters: hidFilters });
    if (devices.length == 0) {
        return false;
    }
    for (let device of devices) {
        addDevice(device);
    }
    return true;
};




const checkConnection = async () => {

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

const tryToActive = () => {
    checkConnection().then(result => {
        if (result == 1) {
            for (let [id, device] of deviceMap.entries()) {
                // read activation time        
                sendReport(device, MSG_R_ACTIVATION);
            }
        }
    });
};

const deactivate = () => {
    checkConnection().then(result => {
        if (result == 1) {
            for (let [id, device] of deviceMap.entries()) {
                // deactivation        
                sendReport(device, MSG_W_DEACTIVATION);
            }
        }
    });
}

const activate = (device) => {
    sendReport(device, MSG_W_ACTIVATION);
};

const sendReport = async (device, buffer) => {
    console.log('sendReport', buffer);
    // try open the device 
    if (!device.opened) {
        await device.open();
    }
    let reportData = new Uint8Array(buffer);
    return device.sendReport(0x00, reportData).then(() => {
        console.log('sent message to device.');
        return true;
    }).catch((error) => {
        console.log('sent message failed', error);
        return false;
    });
}

const addDevice = device => {
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
    device.oninputreport = handleInputReport;

    deviceMap.set(deviceIndex, device);
    deviceIndex += 1;
    console.log('device added = ' + device.productName + ' ' + deviceIndex);
};


const removeDevice = device => {
    for (let id in deviceMap.keys()) {
        if (deviceMap.get(id) === device) {
            deviceMap.delete(id);
            console.log('device removed = ' + device.productName + ' ' + id);
            return;
        }

    }
};


const hidSupported = () => {
    return !(navigator.hid === undefined);
}

const showDialog = (title, message) => {

    let divMessage = document.getElementById('ID_messageMask');

    if (divMessage == null) {
        alert(message);
    } else {
        divMessage.style.display = 'block';
        document.getElementById('ID_messageTitle').innerHTML = title;
        document.getElementById('ID_messageText').innerHTML = message;
    }
}


window.onload = () => {
    if (!hidSupported()) {
        showDialog(messages.title, messages.notSupport);

    } else {
        navigator.hid.getDevices().then(devices => {
            for (let device of devices) {
                addDevice(device);
            }
            navigator.hid.onconnect = e => {
                // add device to connected device list.
                addDevice(e.device);
            };

            navigator.hid.ondisconnect = e => {
                removeDevice(e.device);
            };
        });


        // add click events
        let btnConnect = document.getElementById('ID_connect');
        if (btnConnect != null) {
            btnConnect.onclick = () => {
                tryToActive();
            };
        }



        let btnMessage = document.getElementById('ID_messageButton');
        if (btnMessage != null) {
            btnMessage.onclick = () => {
                document.getElementById('ID_messageMask').style.display = 'none';
            }
        }
    }


};