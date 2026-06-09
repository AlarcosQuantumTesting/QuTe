import { ExecConfiguration } from "./ExecConfiguration"
import { Mutant } from "./Mutant"

export class MutantCycle {
    id: number = 0
    name?: string
    mutants: Mutant[] = []
    execConfiguration?: ExecConfiguration
    date: Date = new Date();


    newlyGenerated: boolean = false;

    constructor(mutants?: Mutant[], id?: number, execConfiguration?: ExecConfiguration, name?: string) {
        if (mutants) {
            this.mutants = [...mutants]

        }
        if (id) {
            this.id = id
            this.name = name || 'Mutant Cycle ' + id;
        }
        if (execConfiguration) {
            this.execConfiguration = execConfiguration;
        }
        else {
            this.execConfiguration = new ExecConfiguration();
        }
        this.date = new Date();
    }

    addMutant(mutant: Mutant) {
        this.mutants.push(mutant);
    }

}
