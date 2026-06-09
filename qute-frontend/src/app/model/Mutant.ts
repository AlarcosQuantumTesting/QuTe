import { QProgram } from "./QProgram"
import { MutantResult } from "./MutantResult"
import { Operator } from "./OperatorFamily"

export class Mutant {
    mutantIndex?: number
    mutatedColumn?: number
    mutatedRow?: number
    mutationOperator?: string
    circuit?: QProgram
    result?: MutantResult
    mutantResults: MutantResult[] = []
    operator: Operator
    id?: string

    constructor(mutantIndex?: number, mutatedColumn?: number, mutatedRow?: number, mutationOperator?: string, circuit?: QProgram) {

        this.mutantIndex = mutantIndex;
        this.mutatedColumn = mutatedColumn;
        this.mutatedRow = mutatedRow;
        this.mutationOperator = mutationOperator;
        this.circuit = circuit;
        this.operator = new Operator({});
        this.operator.name = mutationOperator;

    }



}