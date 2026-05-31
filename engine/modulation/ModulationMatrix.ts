export interface ModulationRoute {
  sourceId: string;
  targetParameter: string;
  amount: number;
}

export class ModulationMatrix {
  private routes: ModulationRoute[] = [];

  public addRoute(route: ModulationRoute) {
    this.routes.push(route);
  }

  public evaluate(
    sourceValues: Record<string, number>,
    target: string
  ): number {
    let total = 0;

    for (const route of this.routes) {
      if (route.targetParameter !== target) continue;

      total += (sourceValues[route.sourceId] || 0) * route.amount;
    }

    return total;
  }
}
