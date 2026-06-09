import type { TestSuite } from "./TestSuite";

export abstract class TestCase {
    id?: string;
    testSuite?: TestSuite;
    entryIndexes: number[] = [];
    outputIndexes: number[] = [];
    type: string | undefined;

    constructor() { }
}
