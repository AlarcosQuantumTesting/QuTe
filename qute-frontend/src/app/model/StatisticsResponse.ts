export interface StatisticsDetail {
    percentage: number;
    killed: number;
    total: number;
}

export interface StatisticsResponse {
    mutation_score: StatisticsDetail;
    kill_rate_per_test: { [key: string]: StatisticsDetail };
    kill_rate_per_mutant: { [key: string]: StatisticsDetail };
    rarely_killed_mutants: string[];
    subsumed_mutants: string[];
    tests_with_unique_kills: { [key: string]: string[] };
}
