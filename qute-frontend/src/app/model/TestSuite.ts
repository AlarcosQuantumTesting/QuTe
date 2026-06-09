import type { Project } from "./Project";
import type { TestCase } from "./TestCase";

export class TestSuite {
    id: string = crypto.randomUUID();
    project?: Project;
    testCases: TestCase[] = [];
    error_range: number = 0;

    constructor() { }
}
