let deviceMap = new Map();
let device = null;
let deviceIndex = 0;


// hid message id bit: 15
// activation bit: 22-30


const MSG_W_ACTIVATION = [
    0xFD, 0xF8, 0xFD, 0xB7, 0x00, 0x1A, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2A,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, // time bit 22th
    0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x00,
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

const hidFilters = [
    { 'vendorId': 0x3318 },
];

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
        time += bytes[i]
    }
};

const debugBuffer = buffer => {
    let bufferString = '';
    for (let byte of buffer)
        bufferString += ' ' + hex8(byte);
    return bufferString;
}

const handleInputReport = ({ device, reportId, data }) => {
    console.log('handleInputReport', data);
    const reportData = new Uint8Array(data.buffer);

    let msgId = reportData[15];
    console.log('reportData.buffer[16]', msgId);
    if (msgId == 0x29) {
        const time = bytes2Time(reportData.subarray(22, 30));
        if (time < 1) {
            console.log('to activate');
            activate(device);

        } else {
            alert('already activated');
        }

    } else if (msgId == 0x2A) {
        alert('activated');
    }
    // for (let byte of reportData)
    //     buffer += ' ' + hex8(byte);
    // console.log(buffer);

    // TODO handle input report

    // if(report.reportId )
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



const activate = (device) => {

    let reportId = 0;
    let reportData = new Uint8Array(MSG_W_ACTIVATION);

    reportData.set(time2Bytes(Date.now()), 22);

    console.log('try activate glasses', debugBuffer(reportData));
    // activation        
    device.sendReport(reportId, reportData).then(() => {
        console.log('activation report sent');
    }).catch((error) => {
        console.log('activation report failed', error);
    });

};

const checkActivation = async () => {
    let permised = await connectDevices();
    if (!permised) {
        alert('no glasses connected');
        return;
    }
    let reportId = 0;
    let reportData = new Uint8Array(MSG_R_ACTIVATION);
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