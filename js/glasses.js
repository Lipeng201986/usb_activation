import { MESSAGES, cmd_build, parse_rsp } from './protocol.js';

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
        let report = parse_rsp(reportData);

        this._reports.set(report.msgId, report);
    }

    sendReport(msgId, payload) {
        const data = new Uint8Array(payload);
        const cmd = cmd_build(msgId, payload);
        this._device.sendReport(0x00, cmd);
    }

    async sendReportTimeout(msgId, payload, timeout) {
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
        return this.sendReportTimeout(MESSAGES.R_ACTIVATION_TIME, [], 1000)
            .then((report) => {
                return report != null;
            });
    }
}