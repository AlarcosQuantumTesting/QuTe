import { TestCase } from "./TestCase";

export class Stochastic extends TestCase {

    probabilityDistribution: Map<string, number> = new Map<string, number>();

    constructor() {
        super();
        this.type = "STOCHASTIC";
    }
}
