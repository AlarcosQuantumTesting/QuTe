export class ExecConfiguration {
    id?: string
    executionDate?: Date
    machine?: string
    execAlgorithm?: string
    testSuiteId?: string

    constructor(execConfiguration?: any) {
        this.id = execConfiguration?.id || crypto.randomUUID()
        this.executionDate = execConfiguration?.executionDate ? new Date(execConfiguration.executionDate) : undefined
        this.machine = execConfiguration?.machine
        this.execAlgorithm = execConfiguration?.execAlgorithm
        this.testSuiteId = execConfiguration?.testSuiteId
    }

}