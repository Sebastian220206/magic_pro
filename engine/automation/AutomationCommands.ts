import { AutomationLane, AutomationPoint, CurveType } from './types';

export interface RootStoreAutomationApi {
  addPoint(laneId: string, point: AutomationPoint): void;
  updatePoint(laneId: string, pointId: string, updates: Partial<AutomationPoint>): void;
  removePoint(laneId: string, pointId: string): void;
  removePoints(laneId: string, pointIds: string[]): void;
}

export interface AutomationCommand {
  execute(store: RootStoreAutomationApi): void;
  undo(store: RootStoreAutomationApi): void;
}

export class AddAutomationPointCommand implements AutomationCommand {
  constructor(
    private laneId: string,
    private point: AutomationPoint
  ) {}

  execute(store: RootStoreAutomationApi) {
    store.addPoint(this.laneId, this.point);
  }

  undo(store: RootStoreAutomationApi) {
    store.removePoint(this.laneId, this.point.id);
  }
}

export class MoveAutomationPointCommand implements AutomationCommand {
  constructor(
    private laneId: string,
    private pointId: string,
    private newBeat: number,
    private newValue: number,
    private oldBeat: number,
    private oldValue: number
  ) {}

  execute(store: RootStoreAutomationApi) {
    store.updatePoint(this.laneId, this.pointId, { beat: this.newBeat, value: this.newValue });
  }

  undo(store: RootStoreAutomationApi) {
    store.updatePoint(this.laneId, this.pointId, { beat: this.oldBeat, value: this.oldValue });
  }
}

export class EditAutomationCurveCommand implements AutomationCommand {
  constructor(
    private laneId: string,
    private pointId: string,
    private newCurve: CurveType,
    private newCurveAmount: number | undefined,
    private oldCurve: CurveType,
    private oldCurveAmount: number | undefined
  ) {}

  execute(store: RootStoreAutomationApi) {
    store.updatePoint(this.laneId, this.pointId, { curve: this.newCurve, curveAmount: this.newCurveAmount });
  }

  undo(store: RootStoreAutomationApi) {
    store.updatePoint(this.laneId, this.pointId, { curve: this.oldCurve, curveAmount: this.oldCurveAmount });
  }
}

export class DeleteAutomationPointsCommand implements AutomationCommand {
  constructor(
    private laneId: string,
    private points: AutomationPoint[]
  ) {}

  execute(store: RootStoreAutomationApi) {
    store.removePoints(this.laneId, this.points.map(p => p.id));
  }

  undo(store: RootStoreAutomationApi) {
    // Re-add deleted points
    for (const point of this.points) {
      store.addPoint(this.laneId, point);
    }
  }
}
