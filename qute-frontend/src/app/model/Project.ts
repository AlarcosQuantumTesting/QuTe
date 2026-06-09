import { QProgram } from "./QProgram";
import { MutantCycle } from "./MutantCycle";
import { ProjectNote } from "./ProjectNote";
import { TestSuite } from "./TestSuite";

export class Project {


    id?: string = crypto.randomUUID();
    name: string = "";
    qProgram: QProgram = new QProgram();
    mutantCycles: MutantCycle[] = [];
    projectNotes: ProjectNote[] = [];
    testSuites: TestSuite[] = [];

    /**
     * Estado de guardado del proyecto (solo frontend, no se persiste en backend)
     * - false: El proyecto tiene cambios sin guardar
     * - true: El proyecto está guardado y sincronizado
     */
    private _saved: boolean = false;

    get saved(): boolean {
        return this._saved;
    }

    set saved(value: boolean) {
        this._saved = value;
    }

    /**
     * Marca el proyecto como modificado (no guardado)
     */
    markAsModified(): void {
        this._saved = false;
    }

    /**
     * Marca el proyecto como guardado
     */
    markAsSaved(): void {
        this._saved = true;
    }

    constructor(id?: string, name?: string, qProgram?: QProgram, mutantCycles?: MutantCycle[], fromServer: boolean = false, projectNotes?: ProjectNote[], testSuites?: TestSuite[]) {
        if (id) {
            this.id = id;
        }
        if (name) {
            this.name = name;
        }
        if (qProgram) {
            this.qProgram = qProgram;
        }
        if (mutantCycles) {
            this.mutantCycles = mutantCycles;
        }
        if (projectNotes) {
            this.projectNotes = projectNotes;
        }
        if (testSuites) {
            this.testSuites = testSuites;
        }

        // Si viene del servidor, está guardado; si es nuevo, no lo está
        this._saved = fromServer;
    }

    addMutantCycle(mutantCycle: MutantCycle) {
        this.mutantCycles.push(mutantCycle)
    }

    getNextMutantCycleId(): number {
        if (!this.mutantCycles || this.mutantCycles.length === 0) return 0;
        return Math.max(...this.mutantCycles.map(mc => mc.id)) + 1;
    }

    getQubits(): number {
        return this.qProgram.getQubits();
    }

}
