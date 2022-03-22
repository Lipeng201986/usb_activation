import { send } from "express/lib/response";



let deviceMap = new Map();
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
const hex8 = value => {
    return ('00' + value.toString(16)).substr(-2).toUpperCase();
};


const time2Bytes = time => {
    let timeBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {

        console.log('', i, (time >> i));
        timeBytes[i] = (time >> i) & 0x000000FF;
    }
    return timeBytes;
};


// FIXME: not correct
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


function bin2String(array) {
    var result = "";
    for (var i = 0; i < array.length; i++) {
        result += String.fromCharCode(parseInt(array[i], 2));
    }
    return result;
}



const handleInputReport = ({ device, reportId, data }) => {
    const reportData = new Uint8Array(data.buffer);

    var result = parse_rsp(reportData);

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

        sendReport(device, cmd_build(MESSAGES.W_UPDATE_MCU_APP_FW_PREPARE)).then(() => {
            console.log('update MCU app fw prepare');
            // jump to boot
            sendReport(device, cmd_build(MESSAGES.W_MCU_APP_JUMP_TO_BOOT)).then(() => {
                navigator.hid.get
            });

        });
    } else if (result.msgId == MESSAGES.W_MCU_APP_JUMP_TO_BOOT) {

        sendReport(device, cmd_build(MESSAGES.W_BOOT_UPDATE_MODE));
    }
};
const connectDevices = async () => {

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
    var time = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x01]);
    sendReport(device, cmd_build(MESSAGES.W_ACTIVATION_TIME, time));
};

const sendReport = async (device, buffer) => {
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


    if (device.productId == 0x0424) {

        device.oninputreport = handleInputReport;

        deviceMap.set(deviceIndex, device);
        deviceIndex += 1;
        console.log('device added = ', device.productName, deviceIndex, device);
    } else if (device.productId == 0x0423) {
        // boot device
        sendFw(device);

    }

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


const upgrade = async () => {

    // switch to boot mode

    // checkConnection().then(result => {
    //     if (result == 1) {
    //         for (let [id, device] of deviceMap.entries()) {
    //             // read activation time        
    //             sendReport(device, MSG_R_ACTIVATION);
    //         }
    //     }
    // });

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



const test = () => {
    var fwData = await readFwFile();
    var data = new Uint8Array(fwData);
    console.log(bytes2String(data));
}


const readFwFile = async () => {
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


    return window.showOpenFilePicker(pickerOpts).then(filePaths => {
        console.log('filePaths', filePaths);
        if (filePaths.length == 0) {
            return;
        }

        return filePaths[0].getFile().then(file => {
            return file.arrayBuffer();
        })

    });
}

async function sendFw(device) {
    var fwData = await readFwFile();

    var data = new Uint8Array(fwData);
    var ofs = 0;

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

    } else {
        navigator.hid.getDevices().then(devices => {
            for (let device of devices) {
                addDevice(device);
            }
            navigator.hid.onconnect = e => {
                console.log('hid connect ', e.device.productId);
                // add device to connected device list.
                addDevice(e.device);
            };

            navigator.hid.ondisconnect = e => {
                console.log('hid disconnect ', e.device.productId);
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

    }

}


const readFw = () => {



}


const HEAD = 0xfd;
const MSG_ID_OFS = 15;
const PAYLOAD_OFS = 22;
const LEN_OFS = 5;
const CRC_OFS = 1;
const TS_OFS = 7;
const RESERVED_OFS = 17;


const MESSAGES = {
    W_CANCEL_ACTIVATION: 0x19,
    R_MCU_APP_FW_VERSION: 0x26,//MCU APP FW version.
    R_ACTIVATION_TIME: 0x29,//Read activation time
    W_ACTIVATION_TIME: 0x2A,//Write activation time

    W_UPDATE_MCU_APP_FW_PREPARE: 0x3E,//Preparations for mcu app fw upgrade
    W_UPDATE_MCU_APP_FW_START: 0x3F,	//(Implemented in Boot)
    W_UPDATE_MCU_APP_FW_TRANSMIT: 0x40,	//(Implemented in Boot)
    W_UPDATE_MCU_APP_FW_FINISH: 0x41,	//(Implemented in Boot)
    W_BOOT_JUMP_TO_APP: 0x42,	//(Implemented in Boot)
    W_MCU_APP_JUMP_TO_BOOT: 0x44,

    W_BOOT_UPDATE_MODE: 0x1100,
    W_BOOT_UPDATE_CONFIRM: 0x1101,
    W_BOOT_UPDATE_PREPARE: 0x1102,

    W_BOOT_UPDATE_START: 0x1103,
    W_BOOT_UPDATE_TRANSMIT: 0x1104,
    W_BOOT_UPDATE_FINISH: 0x1105,
};


const MSG_R_ACTIVATION_TIME = 0x29;

const crc32_table = [
    0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
    0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
    0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
    0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
    0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
    0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
    0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
    0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
    0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
    0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
    0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
    0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
    0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
    0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
    0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
    0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
    0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
    0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
    0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
    0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
    0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
    0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
    0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
    0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
    0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
    0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
    0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
    0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
    0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
    0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
    0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
    0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
    0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
    0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
    0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
    0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
    0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
    0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
    0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
    0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
    0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
    0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
    0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
    0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
    0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
    0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
    0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
    0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
    0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
    0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
    0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
    0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
    0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
    0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
    0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
    0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
    0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
    0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
    0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
    0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
    0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
    0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
    0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
    0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
];


function cmd_crc(buf, len) {
    var CRC32_data = 0xFFFFFFFF;
    for (var i = 0; i != len; ++i) {
        var t = (CRC32_data ^ buf[i]) & 0xFF;
        CRC32_data = ((CRC32_data >> 8) & 0xFFFFFF) ^ crc32_table[t];
    }

    return ~CRC32_data;
};

function cmd_build(msgId, payload) {
    var crc = 0;
    var buff = new Uint8Array(64);
    buff[0] = HEAD;

    // memset(buff + TS_OFS, 0, 8);
    // memset(buff + RESERVED_OFS, 0, 5);

    buff[MSG_ID_OFS] = (msgId >> 0) & 0xff;
    buff[MSG_ID_OFS + 1] = (msgId >> 8) & 0xff;

    var len = /*LEN*/2 + /*TS*/8 + /*MSG_ID*/2 + /*RESERVED*/5;

    if (payload != null && payload.length > 0) {
        console.log("payload len: " + payload.length);
        buff.set(payload, PAYLOAD_OFS);
        len += payload.length;
    }
    buff[LEN_OFS] = (len) & 0xff;
    buff[LEN_OFS + 1] = (len >> 8) & 0xff;

    crc = cmd_crc(buff.slice(LEN_OFS), len);
    buff[CRC_OFS] = (crc >> 0) & 0xff;
    buff[CRC_OFS + 1] = (crc >> 8) & 0xff;
    buff[CRC_OFS + 2] = (crc >> 16) & 0xff;
    buff[CRC_OFS + 3] = (crc >> 24) & 0xff;

    return buff;
};

function get_msgId(response) {
    var msgId = (response[15]) | (response[16] << 8);
    return msgId;
};

function get_status_byte(response) {
    return response[22];
};


function parse_rsp(rsp) {
    var result = {
        msgId: -1,
        status: 0,
        payload: new Uint8Array()
    };

    if (rsp == null || rsp.length < 1) {
        return result;
    }

    result.msgId = get_msgId(rsp);
    result.status = get_status_byte(rsp);


    var packet_len = (rsp[5]) | (rsp[6] << 8);
    if (packet_len < 18) {
        return result;
    }
    packet_len = packet_len - 17 - 1;/* len, ts, msgid, reserve, status*/
    result.payload = rsp.slice(PAYLOAD_OFS + 1, PAYLOAD_OFS + 1 + packet_len);

    return result;
};