export class QCircuit {
    id: string = crypto.randomUUID();
    quirkCode: any;
    textQuirkCode: string = "";


    mutableColumns: string = "-1,";
    mutableRows: string = "";


    constructor(id?: string, quirkCode?: any) {
        if (id) {
            this.id = id;
        }
        if (quirkCode) {
            this.quirkCode = quirkCode;
            this.textQuirkCode = JSON.stringify(quirkCode);

            if (quirkCode.cols && Array.isArray(quirkCode.cols)) {
                for (let i = 0; i < quirkCode.cols.length; i++) {
                    this.mutableColumns += i + ",";
                }
                if (this.mutableColumns.endsWith(",")) {
                    this.mutableColumns = this.mutableColumns.substring(0, this.mutableColumns.length - 1);
                }

                for (let i = 0; i < quirkCode.qubits; i++) {
                    this.mutableRows += i + ",";
                }
                if (this.mutableRows.endsWith(",")) {
                    this.mutableRows = this.mutableRows.substring(0, this.mutableRows.length - 1);
                }
            }
        }


    }


    calculateMutableColumns(): string {
        if (!this.quirkCode) {
            return "";
        }
        let mutableColumns = "";
        for (let i = 0; i < this.quirkCode.cols.length; i++) {
            mutableColumns += i + ",";
        }
        if (mutableColumns.endsWith(",")) {
            mutableColumns = mutableColumns.substring(0, mutableColumns.length - 1);
        }
        return mutableColumns;
    }

    calculateMutableRows(): string {
        if (!this.quirkCode) {
            return "";
        }
        let numQubits = 0;
        if (this.quirkCode.qubits) {
            numQubits = this.quirkCode.qubits;
        } else if (this.quirkCode.cols) {
            for (let i = 0; i < this.quirkCode.cols.length; i++) {
                if (this.quirkCode.cols[i].length > numQubits) {
                    numQubits = this.quirkCode.cols[i].length;
                }
            }
        }

        let mutableRows = "";
        for (let i = 0; i < numQubits; i++) {
            mutableRows += i + ",";
        }
        if (mutableRows.endsWith(",")) {
            mutableRows = mutableRows.substring(0, mutableRows.length - 1);
        }
        return mutableRows;
    }




}