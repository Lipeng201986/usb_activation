let deviceMap = new Map();
let device = null;
let deviceIndex = 0;


// hid message id bit: 16
// activation bit: 23-41


const MSG_W_ACTIVATION = [0x00,
    0xFD, 0xF8, 0xFD, 0xB7, 0x00, 0x1A, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2A,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, // time bit 23th
    0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

const MSG_R_ACTIVATION = [0x00,
    0xFD, 0xCC, 0xDF, 0x3D, 0x03, 0x11, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

const hidFilters = [
    { 'vendorId': 0x3318 },
];

// Formats an 8-bit integer |value| in hexadecimal with leading zeros.
const hex8 = value => {
    return ('00' + value.toString(16)).substr(-2).toUpperCase();
};

const handleInputReport = report => {
    console.log('report id: ' + report.reportId);
    console.log('handleInputReport', report);

    let buffer = '';
    const reportData = new Uint8Array(report.data.buffer);

    if (reportData.buffer[16] == 0x29) {
        console.log('report read activation' + reportData.subarray(23, 41));
    }
    for (let byte of reportData)
        buffer += ' ' + hex8(byte);
    console.log(buffer);

    // TODO handle input report

    // if(report.reportId )
};
const connectDevices = async () => {
    let devices = await navigator.hid.requestDevice({ filters: hidFilters });
    for (let device of devices) {
        addDevice(device);
    }
};



const readActivation = (device) => {


};

const activateGlasses = async () => {
    await connectDevices();

    console.log('try activate glasses');
    let reportId = 0;
    let reportData = new Uint8Array(MSG_R_ACTIVATION).slice(1);
    for (let [id, device] of deviceMap.entries()) {
        // try open the device 
        if (!device.opened) {
            await device.open();
        }
        // read activation time        
        device.sendReport(reportId, reportData).then(() => {
            console.log('activation report sent');
        }).catch((error) => {
            console.log('activation report failed', error);
        });
    }
};


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

const time2Bytes = time => {
    console.log(time);

    let timeBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        timeBytes[i] = (time >> i) & 0xFF;
    }
    console.log(timeBytes);
};


window.onload = () => {
    const time = Date.now();

    time2Bytes(time);

    navigator.hid.getDevices().then(devices => {
        for (let device of devices) {
            addDevice(device);
        }
    });
    navigator.hid.onconnect = e => {
        // add device to connected device list.
        addDevice(e.device);
    };

    navigator.hid.ondisconnect = e => {
        removeDevice(e.device);
    };
};