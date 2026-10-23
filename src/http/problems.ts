export class HttpProblem extends Error {
  constructor(readonly status: number, readonly title: string, readonly detail: string, readonly headers: Record<string, string> = {}) {
    super(detail); this.name = 'HttpProblem';
  }
}
export function problemResponse(problem: HttpProblem, path: string) {
  return { statusCode: problem.status, headers: { 'Content-Type': 'application/problem+json', ...problem.headers },
    body: JSON.stringify({ type: 'about:blank', title: problem.title, status: problem.status, detail: problem.detail, instance: path }) };
}
