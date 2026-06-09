import { TestCase } from "./TestCase";
export class Deterministic extends TestCase {
    entryValues: number[] = [];
    expectedValues: number[] = [];
    constructor() {
        super();
        this.type = "DETERMINISTIC";
    }
}
