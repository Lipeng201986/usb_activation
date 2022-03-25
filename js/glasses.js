import * as Protocol from './protocol.js';


export default class Glasses extends EventTarget {
    constructor(device) {
        super();
        this._device = device;
        this._interestMsg = [];
        this._reports = new Map();
        // set input listener
        device.oninputreport = this._handleInputReport.bind(this);
    }

    get device() { return this._device; }


    connect() {
        if (!this._device.opened) {
            return this._device.open();
        }
        return Promise.resolve();
    }
    _handleInputReport({ device, reportId, data }) {
        const reportData = new Uint8Array(data.buffer);
        let report = Protocol.parse_rsp(reportData);
        this._reports.set(report.msgId, report);
    }

    sendReport(msgId, payload) {
        const data = new Uint8Array(payload);
        const cmd = Protocol.cmd_build(msgId, payload);
        this._device.sendReport(0x00, cmd);
    }

    async sendReportTimeout(msgId, payload = [], timeout = 200) {
        this.sendReport(msgId, payload);
        const time = new Date().getTime();
        while ((new Date().getTime() - time) < timeout) {
            if (this._reports.has(msgId)) {
                let report = this._reports.get(msgId);
                this._reports.delete(msgId);
                return report;
            }
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        return null;
    }

    async isMcu() {
        const report = await this.sendReportTimeout(Protocol.MESSAGES.R_ACTIVATION_TIME);
        return report != null;
    }

    /** activate the glasses */
    async activate() {
        return this.sendReportTimeout(Protocol.MESSAGES.R_ACTIVATION_TIME)
            .then(report => {
                console.log('Activation time:', report.payload);

                if (report && report.status === 0 && report.payload.length > 0) {
                    let time = Protocol.bytes2Time(report.payload);
                    return time > 0;
                }
                else {
                    return false;
                }
            })
            .then(activated => {
                console.log('has activated:', activated);
                if (activated) {
                    return true;
                }
                // hardcode value = 300
                const time = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x01]);
                return this.sendReportTimeout(Protocol.MESSAGES.W_ACTIVATION_TIME, time)
                    .then(report => {
                        return report && report.status === 0;
                    });
            });
    }

    /** deactivate the glasses */
    async deactivate() {
        return this.sendReportTimeout(Protocol.MESSAGES.W_CANCEL_ACTIVATION)
            .then(report => {
                return report && report.status === 0;
            });
    }

    /** read firmware version*/
    async getFirmwareVersion() {
        return this.sendReportTimeout(Protocol.MESSAGES.R_MCU_APP_FW_VERSION)
            .then(report => {
                if (report && report.status === 0) {
                    return String.fromCharCode.apply(null, report.payload);
                }
            });
    }



}